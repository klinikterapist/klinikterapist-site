const WORDS_PER_MINUTE = 200;

export function countWords(markdown: string): number {
  const plain = markdown
    .replace(/<span class="dropcap"><\/span>/g, '') // drop cap marker: no text of its own
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images: drop entirely
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links: keep text, drop URL
    .replace(/```[^\n]*/g, ' ') // code fence markers
    .replace(/[#*_`>~|]/g, ' '); // heading, emphasis, quote, table syntax
  return plain.split(/\s+/).filter((w) => w.length > 0).length;
}

export function readingTime(markdown: string): number {
  return Math.max(1, Math.ceil(countWords(markdown) / WORDS_PER_MINUTE));
}
