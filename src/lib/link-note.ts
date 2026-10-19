/**
 * A link note is plain text. links.json has no language field, so the note's own wording decides whether
 * the account is in English (and gets the British flag): "İngilizce", "In English", "english" ...
 */
export function isEnglishNote(note: string): boolean {
  // Turkish lower case makes "ENGLISH" "englısh"; the plain one makes "İNGİLİZCE" "i̇ngi̇li̇zce". Either may match.
  const re = /ingilizce|english/;
  return re.test(note.toLocaleLowerCase('tr-TR')) || re.test(note.toLowerCase());
}
