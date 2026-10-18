/**
 * A link note is plain text. links.json has no language field, so the note's own wording decides whether
 * the account is in English (and gets the British flag): "İngilizce", "In English", "english" ...
 */
export function isEnglishNote(note: string): boolean {
  return /ingilizce|english/.test(note.toLocaleLowerCase('tr-TR'));
}
