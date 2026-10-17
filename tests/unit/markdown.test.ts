import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown';

describe('renderMarkdown (I3: about texts are Markdown)', () => {
  it('splits paragraphs on blank lines', () => {
    const html = renderMarkdown('Birinci paragraf.\n\nİkinci paragraf.');
    expect(html.match(/<p>/g)).toHaveLength(2);
  });
  it('renders emphasis and safe links', () => {
    const html = renderMarkdown('Bu **önemli** ve *vurgulu*. [Blog](/blog/) ve [site](https://a.co/) ve [posta](mailto:a@b.co)');
    expect(html).toContain('<strong>önemli</strong>');
    expect(html).toContain('<em>vurgulu</em>');
    expect(html).toContain('<a href="/blog/">Blog</a>');
    expect(html).toContain('<a href="https://a.co/">site</a>');
    expect(html).toContain('<a href="mailto:a@b.co">posta</a>');
  });
  it('escapes raw HTML instead of passing it through', () => {
    const html = renderMarkdown('Merhaba <script>alert(1)</script> <b onclick="x()">kalın</b>\n\n<div>blok</div>');
    expect(html).not.toMatch(/<script|<b |<div/);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;div&gt;');
  });
  it('drops unsafe link targets and images', () => {
    const html = renderMarkdown('[tıkla](javascript:alert(1)) ![resim](https://a.co/x.png)');
    expect(html).not.toMatch(/javascript:|<img|href=/);
    expect(html).toContain('tıkla');
    expect(html).toContain('resim');
  });
});
