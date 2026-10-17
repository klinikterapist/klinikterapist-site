import { describe, it, expect } from 'vitest';
import { findPlaceholders } from '../../scripts/check-launch.mjs';

type Hit = { file: string; field: string; value: string; reason: string };

describe('findPlaceholders (I4: launch check)', () => {
  it('finds example.com, university placeholders and bare profile roots, naming file and field', () => {
    const hits: Hit[] = findPlaceholders('links.json', [
      { id: 'instagram', url: 'https://instagram.com/klinikterapist' },
      { id: 'linkedin', url: 'https://www.linkedin.com/' },
      { id: 'medium', url: 'https://medium.com' },
      { id: 'substack', url: 'https://substack.com/' },
      { id: 'email', url: 'mailto:iletisim@example.com' },
    ]);
    expect(hits.map((h) => h.field)).toEqual(['1.url', '2.url', '3.url', '4.url']);
    expect(hits.every((h) => h.file === 'links.json')).toBe(true);
    expect(hits[3].reason).toMatch(/example\.com/);
  });
  it('finds nested placeholders in about.json', () => {
    const hits: Hit[] = findPlaceholders('about.json', {
      timeline: [{ detail: { tr: 'Psikoloji, [Üniversite Adı]', en: 'Psychology, [University Name]' } }],
    });
    expect(hits.map((h) => h.field)).toEqual(['timeline.0.detail.tr', 'timeline.0.detail.en']);
  });
  it('finds the legal draft sentence in Markdown text', () => {
    const hits: Hit[] = findPlaceholders('legal/gizlilik.tr.md', '# Gizlilik\n\n> Bu metin hukuki içerik eklenene kadar taslaktır.\n');
    expect(hits).toHaveLength(1);
    expect(hits[0].field).toBe('satır 3');
  });
  it('accepts real values', () => {
    expect(findPlaceholders('links.json', [
      { url: 'https://www.linkedin.com/in/osman' },
      { url: 'https://medium.com/@osman' },
      { url: 'https://osman.substack.com/' },
      { url: 'mailto:osman@ornek.com.tr' },
    ])).toEqual([]);
    expect(findPlaceholders('legal/gizlilik.tr.md', '# Gizlilik\n\nGerçek metin.')).toEqual([]);
  });
});
