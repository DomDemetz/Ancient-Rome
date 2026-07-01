/**
 * Filter a feature array and, in the same pass, compute a cheap signature that
 * changes iff the *visible set* changes (by original index).
 *
 * react-leaflet's <GeoJSON> ignores `data` prop changes after mount — only a
 * changing `key` re-renders new geometry. Time-filtered layers used to key on
 * `currentYear`, which remounts every playback tick even when the same features
 * stay visible. Keying on this signature instead remounts only when a feature
 * actually enters or leaves; per-year style changes (opacity fades) still apply
 * reactively via Leaflet's setStyle, so no remount is needed for them.
 */
export function filterWithSignature<F>(
  features: F[],
  keep: (feature: F, index: number) => boolean,
): { features: F[]; sig: string } {
  const out: F[] = []
  let hash = 0
  for (let i = 0; i < features.length; i++) {
    if (keep(features[i], i)) {
      out.push(features[i])
      // Rolling hash over the visible original indices — order-stable because
      // filter preserves order, so it's unique to the membership set.
      hash = (hash * 31 + i) | 0
    }
  }
  return { features: out, sig: `${out.length}:${hash}` }
}
