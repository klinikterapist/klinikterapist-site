import { describe, it, expect } from 'vitest';
import { parseRoute } from '../../../src/admin/ui/context';

describe('parseRoute', () => {
  it('maps the panel hashes', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('#/yazilar')).toEqual({ name: 'posts', tab: 'live' });
    expect(parseRoute('#/yazilar/taslaklar')).toEqual({ name: 'posts', tab: 'drafts' });
    expect(parseRoute('#/yazi/abc-1')).toEqual({ name: 'post', key: 'abc-1' });
    expect(parseRoute('#/ayarlar/seo')).toEqual({ name: 'settings', screen: 'seo' });
    expect(parseRoute('#/yazilar/')).toEqual({ name: 'posts', tab: 'live' });
    expect(parseRoute('#/ayarlar/seo/')).toEqual({ name: 'settings', screen: 'seo' });
  });
  it('an unknown address falls back to home', () => {
    expect(parseRoute('#/boyle-bir-sayfa-yok')).toEqual({ name: 'home' });
  });
});
