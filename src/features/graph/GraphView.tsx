import { useEffect, useMemo, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/shallow'
import { entities, connections } from '@/data'
import { useFilterStore } from '@/stores/useFilterStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { useTimelineStore } from '@/stores/useTimelineStore'
import { filterEntities, filterConnections } from '@/lib/filtering'
import { entitiesToNodes, connectionsToLinks, getNodeColor } from './graph.utils'
import { GraphControls } from './GraphControls'
import { TimelinePlayer } from '@/features/timeline/TimelinePlayer'
import type { GraphNode, GraphLink } from '@/types'

export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)

  const filters = useFilterStore(
    useShallow((s) => ({
      entityTypes: s.entityTypes,
      connectionTypes: s.connectionTypes,
      regions: s.regions,
      yearRange: s.yearRange,
    })),
  )

  const selectedId = useSelectionStore((s) => s.selectedId)
  const select = useSelectionStore((s) => s.select)
  const currentYear = useTimelineStore((s) => s.currentYear)

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.4)
  }, [])

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 0.7)
  }, [])

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity)
  }, [])

  // Compute the full node/link set from filters (without currentYear)
  // so the simulation layout is stable while scrubbing the timeline
  const { allNodes, allLinks } = useMemo(() => {
    const filteredEntities = filterEntities(entities, filters)
    const filteredConnections = filterConnections(
      connections,
      filteredEntities,
      filters.connectionTypes,
    )
    const nodes = entitiesToNodes(filteredEntities)
    const nodeIds = new Set(nodes.map((n) => n.id))
    const links = connectionsToLinks(filteredConnections, nodeIds)
    return { allNodes: nodes, allLinks: links }
  }, [filters])

  // Compute which node IDs are visible at the current year
  const visibleIds = useMemo(() => {
    const visible = filterEntities(entities, filters, currentYear)
    return new Set(visible.map((e) => e.id))
  }, [filters, currentYear])

  // Build the D3 simulation once when filters change (not on every year tick)
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    if (simulationRef.current) {
      simulationRef.current.stop()
      simulationRef.current = null
    }

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const width = svgEl.clientWidth || 800
    const height = svgEl.clientHeight || 600

    // Dot grid background pattern
    const defs = svg.append('defs')
    const pattern = defs
      .append('pattern')
      .attr('id', 'dot-grid')
      .attr('width', 24)
      .attr('height', 24)
      .attr('patternUnits', 'userSpaceOnUse')
    pattern
      .append('circle')
      .attr('cx', 12)
      .attr('cy', 12)
      .attr('r', 0.6)
      .attr('fill', 'rgba(255,255,255,0.06)')

    // Node glow filter
    const glow = defs
      .append('filter')
      .attr('id', 'node-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')
    glow.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur')
    const merge = glow.append('feMerge')
    merge.append('feMergeNode').attr('in', 'blur')
    merge.append('feMergeNode').attr('in', 'SourceGraphic')

    svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', 'url(#dot-grid)')

    const g = svg.append('g').attr('class', 'graph-root')

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    zoomRef.current = zoom
    svg.call(zoom)

    const simulation = d3
      .forceSimulation<GraphNode, GraphLink>(allNodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(allLinks)
          .id((d) => d.id)
          .distance(60),
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNode>(12))

    simulationRef.current = simulation

    // Links
    const link = g
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(allLinks)
      .join('line')
      .attr('stroke', '#4a4a5a')
      .attr('stroke-opacity', 0.25)
      .attr('stroke-width', (d) => d.strength ?? 1)

    // Node groups
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(allNodes, (d) => d.id)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, GraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          }),
      )
      .on('click', (_event, d) => {
        select(d.id)
      })

    node
      .append('circle')
      .attr('r', 8)
      .attr('fill', (d) => getNodeColor(d.entityType))
      .style('transition', 'r 0.15s ease, filter 0.15s ease')

    // Hover: scale node + highlight label
    node
      .on('mouseenter', function () {
        d3.select(this).select('circle').attr('r', 11).style('filter', 'url(#node-glow)')
        d3.select(this).select('text').attr('fill', '#fff').attr('font-weight', 600)
      })
      .on('mouseleave', function (_, d) {
        const isSelected = d.id === useSelectionStore.getState().selectedId
        d3.select(this)
          .select('circle')
          .attr('r', isSelected ? 12 : 8)
          .style('filter', isSelected ? 'url(#node-glow)' : 'none')
        d3.select(this).select('text').attr('fill', '#cbd5e1').attr('font-weight', 500)
      })

    node
      .append('text')
      .text((d) => d.name)
      .attr('dx', 11)
      .attr('dy', 3)
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('fill', '#cbd5e1')
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 1px 6px rgba(0,0,0,0.9)')
      .style('transition', 'fill 0.15s ease')

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    return () => {
      simulation.stop()
      simulationRef.current = null
    }
  }, [allNodes, allLinks, select])

  // Update visibility based on currentYear without rebuilding the simulation
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const svg = d3.select(svgEl)

    svg
      .selectAll<SVGGElement, GraphNode>('.nodes g')
      .attr('opacity', (d) => (visibleIds.has(d.id) ? 1 : 0.08))
      .attr('pointer-events', (d) => (visibleIds.has(d.id) ? 'all' : 'none'))

    svg.selectAll<SVGLineElement, GraphLink>('.links line').attr('opacity', (d) => {
      const s = (d.source as GraphNode).id
      const t = (d.target as GraphNode).id
      return visibleIds.has(s) && visibleIds.has(t) ? 0.4 : 0.03
    })
  }, [visibleIds])

  // Update selected node appearance without rebuilding
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const svg = d3.select(svgEl)

    svg
      .selectAll<SVGCircleElement, GraphNode>('.nodes g circle')
      .attr('r', (d) => (d.id === selectedId ? 12 : 8))
      .attr('stroke', (d) => (d.id === selectedId ? '#fff' : 'transparent'))
      .attr('stroke-width', (d) => (d.id === selectedId ? 2 : 0))
      .style('filter', (d) => (d.id === selectedId ? 'url(#node-glow)' : 'none'))
  }, [selectedId])

  return (
    <div className="relative w-full h-full flex flex-col">
      <div
        className="relative flex-1"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(245,158,11,0.02) 0%, rgba(10,10,12,0) 60%)',
        }}
      >
        <svg ref={svgRef} className="w-full h-full" />
        {allNodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center max-w-xs space-y-2">
              <p className="text-slate-500 text-sm">No entities match the current filters.</p>
              <p className="text-slate-600 text-xs">
                Try broadening your search or adjusting the timeline.
              </p>
            </div>
          </div>
        )}
        <GraphControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} />
      </div>
      <TimelinePlayer />
    </div>
  )
}
