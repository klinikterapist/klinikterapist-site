/**
 * A person's name as typed in a form, with capitals (owner's review 2026-10-23, item 19: people often type
 * "ayşe yılmaz"). Each part of the name starts with a capital, in the form's language (i → İ in Turkish);
 * a part typed all in lower or all in upper case gets the rest in lower case, a mixed one ("McDonald",
 * "DeVito") is kept as written. Spaces are squeezed. Used when a request is saved and when the panel
 * shows names saved before this rule.
 */
export function personName(raw: string, lang: 'tr' | 'en' = 'tr'): string {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB';
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\p{L}+/gu, (part) => {
      const lower = part.toLocaleLowerCase(locale);
      const flat = part === lower || part === part.toLocaleUpperCase(locale);
      const rest = flat ? lower.slice(1) : part.slice(1);
      return part.charAt(0).toLocaleUpperCase(locale) + rest;
    });
}
