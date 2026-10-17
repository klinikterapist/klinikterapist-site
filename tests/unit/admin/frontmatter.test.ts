import { describe, it, expect } from 'vitest';
import { parsePost, serializePost, type PostFrontmatter } from '../../../src/admin/lib/frontmatter';
import { postFrontmatterSchema } from '../../../src/lib/schemas';

const fm: PostFrontmatter = {
  title: 'Kaygı: "Düşman" mı, Dost mu?',
  description: 'Açıklama — Türkçe karakterler: ğüşıöç İĞÜŞÖÇ',
  slug: 'kaygi-dusman-mi-dost-mu',
  focusKeyword: 'kaygı',
  category: 'duygular',
  cover: './cover.webp',
  coverAlt: 'Yaprak',
  publishedAt: '2026-10-17',
};

describe('serializePost / parsePost', () => {
  it('round-trips frontmatter with quotes, colons and Turkish characters, and the body', () => {
    const text = serializePost(fm, 'Gövde metni.\n');
    const back = parsePost(text);
    expect(back.fm).toEqual(fm);
    expect(back.body).toBe('Gövde metni.\n');
  });

  it('writes keys in a fixed order, dates unquoted, optional keys only when set', () => {
    const text = serializePost({ ...fm, seoTitle: 'SEO', updatedAt: '2026-11-01' }, 'x\n');
    const keys = text.split('\n').slice(1, 11).map((l) => l.split(':')[0]);
    expect(keys).toEqual(['title', 'seoTitle', 'description', 'slug', 'focusKeyword', 'category', 'cover', 'coverAlt', 'publishedAt', 'updatedAt']);
    expect(text).toContain('\npublishedAt: 2026-10-17\n');
    const bare = serializePost({ ...fm, cover: undefined, coverAlt: undefined }, 'x\n');
    expect(bare).not.toContain('cover');
    expect(bare.startsWith('---\n')).toBe(true);
    expect(bare).toContain('\n---\n\nx\n');
  });

  it('the output passes the build schema', () => {
    const { fm: back } = parsePost(serializePost(fm, 'x\n'));
    expect(() => postFrontmatterSchema(['duygular']).parse(back)).not.toThrow();
  });

  it('reads hand-written Phase 1 frontmatter (unquoted dates, CRLF)', () => {
    const text = '---\r\ntitle: "Eski"\r\ndescription: "D"\r\nslug: "eski"\r\nfocusKeyword: "k"\r\ncategory: "yasam"\r\npublishedAt: 2026-03-10\r\nupdatedAt: 2026-04-01\r\n---\r\n\r\nMetin\r\n';
    const { fm: back, body } = parsePost(text);
    expect(back.publishedAt).toBe('2026-03-10');
    expect(back.updatedAt).toBe('2026-04-01');
    expect(body).toBe('Metin\n');
  });

  it('throws a Turkish error for a file without frontmatter', () => {
    expect(() => parsePost('no frontmatter')).toThrow(/frontmatter/);
  });
});
