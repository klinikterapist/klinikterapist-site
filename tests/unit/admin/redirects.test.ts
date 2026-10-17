import { describe, it, expect } from 'vitest';
import { applyPathChanges } from '../../../src/admin/lib/redirects';
import { parseRedirects } from '../../../src/lib/schemas';

const live = (...paths: string[]) => new Set(paths);

describe('applyPathChanges', () => {
  it('a rename adds old → new', () => {
    const { redirects } = applyPathChanges([], [{ from: '/blog/a/', to: '/blog/b/' }], live('/blog/b/'));
    expect(redirects).toEqual([{ from: '/blog/a/', to: '/blog/b/' }]);
  });

  it('a second rename retargets the first, so there is never a chain', () => {
    let r = applyPathChanges([], [{ from: '/blog/a/', to: '/blog/b/' }], live('/blog/b/')).redirects;
    r = applyPathChanges(r, [{ from: '/blog/b/', to: '/blog/c/' }], live('/blog/c/')).redirects;
    expect(r).toEqual([
      { from: '/blog/a/', to: '/blog/c/' },
      { from: '/blog/b/', to: '/blog/c/' },
    ]);
    expect(() => parseRedirects(r)).not.toThrow();
  });

  it('renaming back to an old address removes the redirect that address had', () => {
    let r = applyPathChanges([], [{ from: '/blog/a/', to: '/blog/b/' }], live('/blog/b/')).redirects;
    r = applyPathChanges(r, [{ from: '/blog/b/', to: '/blog/c/' }], live('/blog/c/')).redirects;
    const out = applyPathChanges(r, [{ from: '/blog/c/', to: '/blog/a/' }], live('/blog/a/'));
    expect(out.redirects).toEqual([
      { from: '/blog/b/', to: '/blog/a/' },
      { from: '/blog/c/', to: '/blog/a/' },
    ]);
    expect(() => parseRedirects(out.redirects)).not.toThrow();
  });

  it('a new live page takes over an old redirect address, with a notice', () => {
    const out = applyPathChanges([{ from: '/blog/eski/', to: '/blog/baska/' }], [], live('/blog/eski/'));
    expect(out.redirects).toEqual([]);
    expect(out.notices[0]).toContain('/blog/eski/');
  });

  it('nothing changes when nothing moved', () => {
    const list = [{ from: '/blog/x/', to: '/blog/y/' }];
    expect(applyPathChanges(list, [{ from: '/blog/y/', to: '/blog/y/' }], live('/blog/y/'))).toEqual({ redirects: list, notices: [] });
  });
});
