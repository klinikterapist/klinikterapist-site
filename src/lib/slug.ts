export type Lang = 'tr' | 'en';

const TR_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
};

export function slugify(text: string, lang: Lang): string {
  const lowered = text.toLocaleLowerCase(lang === 'tr' ? 'tr-TR' : 'en-US');
  const mapped = lowered.replace(/[çğıöşü]/g, (ch) => TR_MAP[ch]);
  return mapped
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
