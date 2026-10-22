/** Small helpers the appointment pages share. */

/** Up to three initials for the round badge on a card ("Ayşe Yılmaz" → "AY"). */
export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');

type Dated = { createdAt: number; day: string; time: string };

/** Aktif talepler: the newest request first (owner's note 2026-10-22). */
export const newestFirst = <T extends Dated>(list: T[]): T[] => [...list].sort((a, b) => b.createdAt - a.createdAt);

/** Onaylanan: by the appointment's date and time, the nearest first (owner's note 2026-10-22). */
export const byAppointment = <T extends Dated>(list: T[]): T[] =>
  [...list].sort((a, b) => `${a.day} ${a.time}`.localeCompare(`${b.day} ${b.time}`) || a.createdAt - b.createdAt);
