// Presentational only, for the SERP preview widget's truncation -- the real
// score comes from the server (src/lib/seo-score.ts), never recomputed here.
// See that file for why this is a lookup table rather than a measurement.
const WIDTH_TABLE: Record<string, number> = {
  i: 0.28, l: 0.28, j: 0.28, I: 0.28, '.': 0.28, ',': 0.28, "'": 0.28, '!': 0.28, ':': 0.28, ';': 0.28,
  f: 0.33, t: 0.33, r: 0.33, '(': 0.33, ')': 0.33, '"': 0.4,
  ' ': 0.29, '-': 0.36, s: 0.5, z: 0.5, a: 0.56, c: 0.5, e: 0.56, g: 0.56, k: 0.5, n: 0.61,
  o: 0.61, p: 0.61, q: 0.61, u: 0.61, v: 0.5, x: 0.5, y: 0.5, b: 0.61, d: 0.61, h: 0.61, m: 0.89,
  A: 0.72, B: 0.72, C: 0.72, D: 0.78, E: 0.67, F: 0.61, G: 0.78, H: 0.78, J: 0.5, K: 0.72,
  L: 0.61, N: 0.78, O: 0.78, P: 0.67, Q: 0.78, R: 0.72, S: 0.67, T: 0.61, U: 0.78, V: 0.72,
  W: 1.0, X: 0.72, Y: 0.67, Z: 0.61, M: 0.94,
};
export function pixelWidth(text: string, fontSizePx: number): number {
  let ems = 0;
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') ems += 0.56;
    else ems += WIDTH_TABLE[ch] ?? 0.58;
  }
  return ems * fontSizePx;
}
export function truncateToPx(text: string, fontSizePx: number, maxPx: number): string {
  if (pixelWidth(text, fontSizePx) <= maxPx) return text;
  let out = text;
  while (out.length > 1 && pixelWidth(out + '…', fontSizePx) > maxPx) out = out.slice(0, -1);
  return out + '…';
}
