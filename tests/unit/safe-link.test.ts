import { describe, expect, it } from 'vitest';
import { isExternalUrl, newTabAttrs } from '../../src/lib/safe-link';

describe('new-tab rule for links (resources)', () => {
  it('opens other sites in a new tab', () => {
    expect(isExternalUrl('https://example.com/x')).toBe(true);
    expect(isExternalUrl('HTTP://example.com')).toBe(true);
    expect(newTabAttrs('https://example.com/x')).toEqual({ target: '_blank', rel: 'noopener noreferrer' });
  });

  it('keeps site paths and mail links in the same tab', () => {
    for (const url of ['/blog/x/', '/kaynaklar/#tur-book', 'mailto:a@b.co']) {
      expect(isExternalUrl(url), url).toBe(false);
      expect(newTabAttrs(url), url).toEqual({});
    }
  });
});
