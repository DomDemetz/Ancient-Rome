import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'
import { useShallow } from 'zustand/shallow'
import { entities, connections } from '@/data'
import { useFilterStore } from '@/stores/useFilterStore'
import { useSelectionStore } from '@/stores/useSelectionStore'
import { filterEntities, filterConnections } from '@/lib/filtering'
import { entitiesToNodes, connectionsToLinks, getNodeColor } from './graph.utils'
import { GraphControls } from './GraphControls'
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
      searchQuery: s.searchQuery,
    })),
  )

  const selectedId = useSelectionStore((s) => s.selectedId)
  const select = useSelectionStore((s) => s.select)

  const handleZoomIn = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, 1.4)
  }, [])

  const handleZoomOut = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.scaleBy, 1 / 1.4)
  }, [])

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, d3.zoomIdentity)
  }, [])

  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    // Stop previous simulation
    if (simulationRef.current) {
      simulationRef.current.stop()
    }

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const width = svgEl.clientWidth || 800
    const height = svgEl.clientHeight || 600

    // Filter data
    const filteredEntities = filterEntities(entities, filters)
    const filteredConnections = filterConnections(
      connections,
      filteredEntities,
      filters.connectionTypes,
    )

    // Convert to graph nodes/links
    const nodes: GraphNode[] = entitiesToNodes(filteredEntities)
    const nodeIds = new Set(nodes.map((n) => n.id))
    const links: GraphLink[] = connectionsToLinks(filteredConnections, nodeIds)

    // Main group for zoom/pan
    const g = svg.append('g').attr('class', 'graph-root')

    // Zoom behavior
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    zoomRef.current = zoom
    svg.call(zoom)

    // Simulation
    const simulation = d3
      .forceSimulation<GraphNode, GraphLink>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
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
      .data(links)
      .join('line')
      .attr('stroke', '#555')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', (d) => d.strength ?? 1)

    // Node groups
    const node = g
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes, (d) => d.id)
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

    // Node circles
    node
      .append('circle')
      .attr('r', (d) => (d.id === selectedId ? 10 : 6))
      .attr('fill', (d) => getNodeColor(d.entityType))
      .attr('stroke', (d) => (d.id === selectedId ? '#fff' : 'transparent'))
      .attr('stroke-width', (d) => (d.id === selectedId ? 2.5 : 0))

    // Node labels
    node
      .append('text')
      .text((d) => d.name)
      .attr('dx', 8)
      .attr('dy', 3)
      .attr('font-size', 9)
      .attr('fill', '#ccc')
      .attr('pointer-events', 'none')

    // Tick handler
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
    }
    // Re-run when filters change (selectedId changes handled separately below)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  // Update selected node appearance without rebuilding the whole simulation
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const svg = d3.select(svgEl)

    svg
      .selectAll<SVGCircleElement, GraphNode>('.nodes g circle')
      .attr('r', (d) => (d.id === selectedId ? 10 : 6))
      .attr('stroke', (d) => (d.id === selectedId ? '#fff' : 'transparent'))
      .attr('stroke-width', (d) => (d.id === selectedId ? 2.5 : 0))
  }, [selectedId])

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
      <GraphControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} />
    </div>
  )
}
