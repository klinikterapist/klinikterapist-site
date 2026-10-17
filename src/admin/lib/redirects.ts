/**
 * Keeps `redirects.json` valid when pages move: old → new, no chains, no redirect sitting on a
 * live page (the build would fail on either).
 */
import { parseRedirects, type Redirect } from '../../lib/schemas';

const BLOG_INDEXES = new Set(['/blog/', '/en/blog/']);

export type PathChange = { from: string; to: string };

export function applyPathChanges(
  redirects: Redirect[],
  changes: PathChange[],
  livePaths: Set<string>,
): { redirects: Redirect[]; notices: string[] } {
  let list = redirects.map((r) => ({ ...r }));
  for (const { from, to } of changes) {
    if (from === to) continue;
    // Everything that went to the old address now goes straight to the new one.
    list = list.map((r) => (r.to === from ? { ...r, to } : r)).filter((r) => r.from !== from);
    list.push({ from, to });
  }
  list = list.filter((r) => r.from !== r.to);
  const notices: string[] = [];
  list = list.filter((r) => {
    if (!livePaths.has(r.from)) return true;
    // Worth telling only when the old address led to other content (not a blog index).
    if (!BLOG_INDEXES.has(r.to) && !changes.some((c) => c.to === r.to || c.from === r.to)) {
      notices.push(`"${r.from}" adresi daha önce "${r.to}" adresine yönleniyordu; artık bu sayfayı gösterecek.`);
    }
    return false;
  });
  return { redirects: parseRedirects(list), notices };
}

export const redirectsJson = (list: Redirect[]) => `${JSON.stringify(list, null, 2)}\n`;
