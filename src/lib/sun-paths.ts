/** The sun mark's path data (halo, disc and the face strokes) from src/assets/brand/sun.svg's text. */
export type SunPaths = { halo: string; disc: string; face: string[] };

export function parseSun(source: string): SunPaths {
  const pathD = (cls: string) => source.match(new RegExp(`<path class="${cls}" d="([^"]+)"`))![1];
  const face = [...source.match(/<g class="face"[^>]*>([\s\S]*?)<\/g>/)![1].matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
  return { halo: pathD('halo'), disc: pathD('disc'), face };
}
