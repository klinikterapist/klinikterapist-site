import { describe, it, expect } from 'vitest';
import {
  getProfile, getLinks, getHome, getAbout, getContact, getResources,
  getCategories, getSeo, getRedirects, parseProfile, parseLinks,
} from '../../src/lib/settings';

describe('real seed files', () => {
  it('all parse', () => {
    expect(() => getProfile()).not.toThrow();
    expect(() => getLinks()).not.toThrow();
    expect(() => getHome()).not.toThrow();
    expect(() => getAbout()).not.toThrow();
    expect(() => getContact()).not.toThrow();
    expect(() => getResources()).not.toThrow();
    expect(() => getSeo()).not.toThrow();
    expect(getRedirects()).toEqual([]);
  });
  it('has the seed categories', () => {
    const ids = getCategories().map((c) => c.id);
    expect(ids).toContain('zihinsel-saglik');
    expect(ids).toHaveLength(6);
  });
  it('has no location wording', () => {
    const all = JSON.stringify([getProfile(), getAbout(), getContact()]);
    expect(all).not.toMatch(/yüz yüze|in-person/i);
  });
});

describe('validation errors name file and field', () => {
  it('profile', () => {
    expect(() => parseProfile({ name: 'x' })).toThrow(/profile\.json.*title/);
  });
  it('nested field path', () => {
    expect(() => parseLinks([{ id: 'a', label: 'a', url: 'u', icon: 'nope', inHero: true, inFooter: true }]))
      .toThrow(/links\.json.*0\.icon/);
  });
});
