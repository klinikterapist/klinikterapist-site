import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import type { JSONContent } from '@tiptap/core';
import { docToMarkdown, markdownToDoc } from '../../../src/admin/lib/markdown';
import { parsePost } from '../../../src/admin/lib/frontmatter';
import type { CiteItem, Reference } from '../../../src/lib/apa';
import { UnknownReferenceError } from '../../../src/lib/citations';

const t = (text: string, ...marks: JSONContent['marks'] & object): JSONContent => (marks.length ? { type: 'text', text, marks } : { type: 'text', text });
const p = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', content });
const bold = { type: 'bold' };
const italic = { type: 'italic' };
const strike = { type: 'strike' };
const highlight = { type: 'highlight' };
const link = (href: string) => ({ type: 'link', attrs: { href } });

/** Comparable form: marks sorted, link attrs reduced to href, empty content dropped. */
function norm(node: JSONContent): JSONContent {
  const out: JSONContent = { type: node.type };
  if (node.attrs) out.attrs = node.attrs;
  if (node.text !== undefined) out.text = node.text;
  if (node.marks?.length) {
    out.marks = node.marks
      .map((m) => (m.type === 'link' ? { type: 'link', attrs: { href: m.attrs?.href } } : { type: m.type }))
      .sort((a, b) => a.type.localeCompare(b.type));
  }
  if (node.content?.length) out.content = node.content.map(norm);
  return out;
}

const everything: JSONContent = {
  type: 'doc',
  content: [
    p(t('Düz metin, '), t('kalın', bold), t(' ve '), t('italik', italic), t(' ve '), t('ikisi', bold, italic), t('.')),
    p(t('Bir '), t('çizik', strike), t(' ve '), t('vurgu', highlight), t(' ve '), t('ikisi', strike, highlight, bold), t('.')),
    { type: 'heading', attrs: { level: 2 }, content: [t('Alt başlık')] },
    { type: 'heading', attrs: { level: 3 }, content: [t('Daha küçük')] },
    p(t('Bir '), t('site içi bağlantı', link('/hakkimda/')), t(' ve '), t('kalın dış bağlantı', link('https://a.co/x?y=1'), bold), t('.')),
    { type: 'blockquote', content: [p(t('Alıntı satırı.'))] },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(t('Birinci'))] },
        { type: 'listItem', content: [p(t('İkinci '), t('vurgulu', italic))] },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 1 },
      content: [
        { type: 'listItem', content: [p(t('Bir'))] },
        { type: 'listItem', content: [p(t('İki'))] },
      ],
    },
    { type: 'horizontalRule' },
    { type: 'figure', attrs: { src: './yaprak.webp', alt: 'Yaprak çizimi', caption: 'Adaçayı "yeşili" yaprak' } },
    { type: 'figure', attrs: { src: './ikinci.webp', alt: 'İkinci', caption: '' } },
    { type: 'youtube', attrs: { id: 'dQw4w9WgXcQ' } },
    { type: 'callout', content: [p(t('Vurgu kutusunda '), t('önemli', bold), t(' not.'))] },
    p(t('Satır'), { type: 'hardBreak' }, t('kırılır.')),
  ],
};

describe('docToMarkdown ⇄ markdownToDoc', () => {
  it('round-trips every node and mark', () => {
    const md = docToMarkdown(everything, 'tr');
    expect(norm(markdownToDoc(md))).toEqual(norm(everything));
  });

  it('writes the exact syntax the site renders (Task 2)', () => {
    const md = docToMarkdown(everything, 'tr');
    expect(md).toContain('![Yaprak çizimi](./yaprak.webp "Adaçayı \\"yeşili\\" yaprak")');
    expect(md).toContain('![İkinci](./ikinci.webp)\n');
    expect(md).toContain(
      '<div class="youtube" data-id="dQw4w9WgXcQ"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Videoyu YouTube\'da izleyin</a></div>',
    );
    expect(md).toContain('<aside class="callout">\n\nVurgu kutusunda **önemli** not.\n\n</aside>');
    expect(md).toContain('**kalın**');
    expect(md).toContain('_italik_');
    expect(md).toContain('- Birinci\n- İkinci');
    expect(md.endsWith('\n') && !md.endsWith('\n\n')).toBe(true);
    expect(docToMarkdown({ type: 'doc', content: [{ type: 'youtube', attrs: { id: 'dQw4w9WgXcQ' } }] }, 'en')).toContain('>Watch the video on YouTube</a>');
  });

  it('keeps Markdown characters in text literal', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [p(t('*yıldız* [köşeli] #etiket _alt_ <b>html</b> `kod` & ~çizgi~ | boru')), p(t('- tire ile başlar')), p(t('1. rakamla başlar')), p(t('+ artı'))],
    };
    const md = docToMarkdown(doc, 'tr');
    expect(norm(markdownToDoc(md))).toEqual(norm(doc));
  });

  it('writes strike and highlight syntax, and keeps look-alike text literal', () => {
    const md = docToMarkdown(everything, 'tr');
    expect(md).toContain('~~çizik~~');
    expect(md).toContain('<mark>vurgu</mark>');
    const doc: JSONContent = { type: 'doc', content: [p(t('a ~~b~~ <mark>c</mark>'))] };
    const lit = docToMarkdown(doc, 'tr');
    expect(lit).toContain('\\~\\~b\\~\\~');
    expect(lit).toContain('\\<mark');
    expect(norm(markdownToDoc(lit))).toEqual(norm(doc));
  });

  it('keeps whitespace outside emphasis markers', () => {
    const doc: JSONContent = { type: 'doc', content: [p(t('a'), t(' kalın ', bold), t('b'))] };
    const md = docToMarkdown(doc, 'tr');
    expect(md).toBe('a **kalın** b\n');
  });

  it('parses the fixture post the site builds into figure, callout and youtube nodes', () => {
    const { body } = parsePost(readFileSync('tests/fixtures/content/ornek-zengin/tr.md', 'utf8'));
    const types = markdownToDoc(body).content!.map((n) => n.type);
    expect(types).toEqual(['paragraph', 'figure', 'callout', 'youtube']);
    expect(markdownToDoc(body).content![0].attrs).toEqual({ dropCap: true });
    const fig = markdownToDoc(body).content![1];
    expect(fig.attrs).toEqual({ src: './gorsel.webp', alt: 'Yaprak çizimi', caption: 'Adaçayı yeşili bir yaprak' });
  });

  it('turns unknown HTML into literal text instead of dropping or rendering it', () => {
    const doc = markdownToDoc('<script>alert(1)</script>\n');
    expect(doc.content).toHaveLength(1);
    expect(doc.content![0].type).toBe('paragraph');
    expect(doc.content![0].content![0].text).toContain('<script>');
  });

  it('skips empty paragraphs and handles an empty document', () => {
    expect(docToMarkdown({ type: 'doc', content: [{ type: 'paragraph' }, p(t('x')), { type: 'paragraph' }] }, 'tr')).toBe('x\n');
    expect(markdownToDoc('').content).toEqual([]);
  });
});

describe('readable source', () => {
  it('does not escape ordinary punctuation', () => {
    const doc: JSONContent = { type: 'doc', content: [p(t('Merhaba! Ali & Ayşe; &amp; kalır.'))] };
    const md = docToMarkdown(doc, 'tr');
    expect(md).toBe('Merhaba! Ali & Ayşe; \\&amp; kalır.\n');
    expect(norm(markdownToDoc(md))).toEqual(norm(doc));
  });
});

describe('citations', () => {
  const RAY: Reference = { id: 'ray2004', type: 'article', authors: [{ family: 'Ray', given: 'O.' }], year: 2004, title: 'Mind' };
  const SMITH: Reference = {
    id: 'smith2010', type: 'book', authors: [{ family: 'Smith', given: 'J.' }, { family: 'Lee', given: 'K.' }], year: 2010, title: 'Steps',
  };
  const NOAUTH: Reference = { id: 'book2020', type: 'book', authors: [], year: 2020, title: 'Untitled <book>' };
  const RAY_B: Reference = { ...RAY, id: 'ray2004-2', title: 'Other' };
  const cite = (items: CiteItem[], narrative = false): JSONContent => ({ type: 'citation', attrs: { items, narrative } });
  const both = [{ id: 'ray2004' }, { id: 'smith2010', locator: { kind: 'p' as const, value: '34' } }];

  it('writes a parenthetical citation as a cite tag and reads it back as the same node', () => {
    const doc: JSONContent = { type: 'doc', content: [p(t('Bkz. '), cite(both), t(' sonra.'))] };
    const md = docToMarkdown(doc, 'tr', [SMITH, RAY]);
    expect(md).toContain('<cite data-refs="ray2004;smith2010~p~34">(Ray, 2004; Smith ve Lee, 2010, s. 34)</cite>');
    expect(norm(markdownToDoc(md))).toEqual(norm(doc));
  });

  it('marks narrative citations with data-narrative', () => {
    const doc: JSONContent = { type: 'doc', content: [p(cite(both, true), t(' gösterdi.'))] };
    const md = docToMarkdown(doc, 'tr', [SMITH, RAY]);
    expect(md).toContain('<cite data-refs="ray2004;smith2010~p~34" data-narrative>Ray (2004) ve Smith ve Lee (2010, s. 34)</cite>');
    expect(norm(markdownToDoc(md))).toEqual(norm(doc));
  });

  it('italicises a no-author title and escapes the text', () => {
    const doc: JSONContent = { type: 'doc', content: [p(cite([{ id: 'book2020' }]))] };
    const md = docToMarkdown(doc, 'en', [NOAUTH]);
    expect(md).toContain('<cite data-refs="book2020">(<i>Untitled \\<book\\></i>, 2020)</cite>');
    expect(norm(markdownToDoc(md))).toEqual(norm(doc));
  });

  it('computes 2004a/2004b over the cited references only', () => {
    const one: JSONContent = { type: 'doc', content: [p(cite([{ id: 'ray2004' }]))] };
    expect(docToMarkdown(one, 'en', [RAY, RAY_B])).toContain('>(Ray, 2004)</cite>');
    const two: JSONContent = { type: 'doc', content: [p(cite([{ id: 'ray2004' }]), t(' '), cite([{ id: 'ray2004-2' }]))] };
    const md = docToMarkdown(two, 'en', [RAY, RAY_B]);
    expect(md).toContain('>(Ray, 2004a)</cite>');
    expect(md).toContain('>(Ray, 2004b)</cite>');
  });

  it('keeps a cite with an unknown attribute shape as plain text', () => {
    for (const md of ['<cite data-refs="a b">(x)</cite>\n', '<cite class="c" data-refs="a">(x)</cite>\n', '<cite data-refs="a" data-x>(x)</cite>\n']) {
      const doc = markdownToDoc(md);
      expect(JSON.stringify(doc), md).not.toContain('"citation"');
      expect(doc.content![0].content!.map((n) => n.text).join(''), md).toBe(md.trim());
    }
  });

  it('keeps escaped cite text as text', () => {
    const doc: JSONContent = { type: 'doc', content: [p(t('<cite data-refs="x">(Ray, 2004)</cite>'))] };
    const md = docToMarkdown(doc, 'tr');
    expect(md).toContain('\\<cite data-refs="x"\\>');
    expect(norm(markdownToDoc(md))).toEqual(norm(doc));
    expect(JSON.stringify(markdownToDoc('\\<cite data-refs="x">y\\</cite>\n'))).not.toContain('"citation"');
  });

  it('writes the text and the attribute from the same sanitized items', () => {
    const doc: JSONContent = { type: 'doc', content: [p(cite([{ id: 'ray2004', locator: { kind: 'p', value: '1;2' } }]))] };
    expect(docToMarkdown(doc, 'tr', [RAY])).toBe('<cite data-refs="ray2004~p~12">(Ray, 2004, s. 12)</cite>\n');
  });

  it('never writes a malicious locator kind', () => {
    const evil = { id: 'ray2004', locator: { kind: '"><img src=x onerror=alert(1)>', value: '1' } } as unknown as CiteItem;
    const md = docToMarkdown({ type: 'doc', content: [p(cite([evil]))] }, 'en', [RAY]);
    expect(md).toBe('<cite data-refs="ray2004">(Ray, 2004)</cite>\n');
  });

  it('a citation to a missing reference throws UnknownReferenceError', () => {
    expect(() => docToMarkdown({ type: 'doc', content: [p(cite([{ id: 'nope' }]))] }, 'tr', [RAY])).toThrow(UnknownReferenceError);
  });

  it('closes open marks around a citation', () => {
    const doc: JSONContent = { type: 'doc', content: [p(t('kalın', bold), cite([{ id: 'ray2004' }]), t('son', bold))] };
    const md = docToMarkdown(doc, 'tr', [RAY]);
    expect(md).toBe('**kalın**<cite data-refs="ray2004">(Ray, 2004)</cite>**son**\n');
  });
});

describe('drop cap', () => {
  const RAY: Reference = { id: 'ray2004', type: 'article', authors: [{ family: 'Ray', given: 'O.' }], year: 2004, title: 'Mind' };
  const dc = (...content: JSONContent[]): JSONContent => ({ type: 'paragraph', attrs: { dropCap: true }, content });

  it('drop cap round-trips', () => {
    const doc: JSONContent = { type: 'doc', content: [dc(t('“Bu gün” dedi.')), p(t('Sonra.'))] };
    const md = docToMarkdown(doc, 'tr');
    expect(md).toBe('<span class="dropcap"></span>“Bu gün” dedi.\n\nSonra.\n');
    expect(markdownToDoc(md).content).toEqual([dc(t('“Bu gün” dedi.')), p(t('Sonra.'))]);
  });

  it('drop cap before a citation or bold text round-trips', () => {
    const cited: JSONContent = { type: 'doc', content: [dc({ type: 'citation', attrs: { items: [{ id: 'ray2004' }], narrative: true } }, t(' gösterdi.'))] };
    const md = docToMarkdown(cited, 'tr', [RAY]);
    expect(md).toBe('<span class="dropcap"></span><cite data-refs="ray2004" data-narrative>Ray (2004)</cite> gösterdi.\n');
    expect(markdownToDoc(md).content?.[0]).toMatchObject({ attrs: { dropCap: true }, content: [{ type: 'citation' }, { text: ' gösterdi.' }] });
    const bolded: JSONContent = { type: 'doc', content: [dc(t('Kaygı', bold), t(' bir duygudur.'))] };
    const md2 = docToMarkdown(bolded, 'tr');
    expect(md2).toBe('<span class="dropcap"></span>**Kaygı** bir duygudur.\n');
    expect(markdownToDoc(md2).content).toEqual([dc(t('Kaygı', bold), t(' bir duygudur.'))]);
  });

  it('a paragraph without the drop cap writes no span; the span elsewhere stays text', () => {
    expect(docToMarkdown({ type: 'doc', content: [{ type: 'paragraph', attrs: { dropCap: false }, content: [t('Düz.')] }] }, 'tr')).toBe('Düz.\n');
    expect(markdownToDoc('Önce <span class="dropcap"></span>sonra.\n').content?.[0].attrs).toBeUndefined();
  });
});
