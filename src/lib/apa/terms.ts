/** Language tables for APA phrases. The only place these strings live (spec 5.7). */
import type { Lang } from '../settings';

export type Terms = {
  /** Before the last author in the reference list and in parenthetical citations. */
  and: string;
  /** Before the last author in narrative citations. */
  andNarrative: string;
  etAl: string;
  nd: string;
  inpress: string;
  p: string;
  pp: string;
  para: string;
  ch: string;
  ed: string;
  eds: string;
  /** Edition label for a number, e.g. `3rd ed.` / `3. bs.`. */
  edition: (n: number) => string;
  /** Chapter wrapper around "Editors (Ed.), <i>Book</i>". */
  chapterBefore: string;
  chapterAfter: string;
  months: string[];
  /** Text placed before the URL when a retrieval date is given. */
  retrieved: (day: number, month: number, year: number) => string;
  referencesHeading: string;
};

const ordinalEn = (n: number): string => {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export const TERMS: Record<Lang, Terms> = {
  tr: {
    and: 've',
    andNarrative: 've',
    etAl: 'vd.',
    nd: 't.y.',
    inpress: 'baskıda',
    p: 's.',
    pp: 'ss.',
    para: 'paragraf',
    ch: 'Bölüm',
    ed: '(Ed.)',
    eds: '(Ed.)',
    edition: (n) => `${n}. bs.`,
    chapterBefore: '',
    chapterAfter: ' içinde',
    months: MONTHS_TR,
    retrieved: (d, m, y) => `Erişim tarihi: ${d} ${MONTHS_TR[m - 1]} ${y}, `,
    referencesHeading: 'Kaynakça',
  },
  en: {
    and: '&',
    andNarrative: 'and',
    etAl: 'et al.',
    nd: 'n.d.',
    inpress: 'in press',
    p: 'p.',
    pp: 'pp.',
    para: 'para.',
    ch: 'Chapter',
    ed: '(Ed.)',
    eds: '(Eds.)',
    edition: (n) => `${ordinalEn(n)} ed.`,
    chapterBefore: 'In ',
    chapterAfter: '',
    months: MONTHS_EN,
    retrieved: (d, m, y) => `Retrieved ${MONTHS_EN[m - 1]} ${d}, ${y}, from `,
    referencesHeading: 'References',
  },
};
