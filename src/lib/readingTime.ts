const WORDS_PER_MINUTE = 200;

export function readingTime(markdown: string): number {
  const plain = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images: drop entirely
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links: keep text, drop URL
    .replace(/```[^\n]*/g, ' ') // code fence markers
    .replace(/[#*_`>~|]/g, ' '); // heading, emphasis, quote, table syntax
  const words = plain.split(/\s+/).filter((w) => w.length > 0).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
