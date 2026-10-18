/** "<title> <name>" for the post's author line; an empty part is left out (R-F8). */
export function authorWho(title: string, name: string): string {
  return [title.trim(), name.trim()].filter(Boolean).join(' ');
}
