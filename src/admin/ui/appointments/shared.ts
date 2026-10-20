/** Small helpers the appointment pages share. */

/** Up to three initials for the round badge on a card ("Ayşe Yılmaz" → "AY"). */
export const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('');
