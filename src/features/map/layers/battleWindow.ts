/** How far back a battle stays on the map. Paused: a generation of recent
 *  history (jumping to 200 BC should SHOW the Punic Wars, not a 5-year
 *  sliver). Playing: scaled to speed so battles flare and fade in step.
 *  StatsOverlay counts with the SAME window — the chip must never claim
 *  battles the map isn't drawing. */
export function battleVisibilityWindow(playing: boolean, speed: number): number {
  return playing ? Math.min(50, Math.max(10, Math.round(speed * 12))) : 25
}
