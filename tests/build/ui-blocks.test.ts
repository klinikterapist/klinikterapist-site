import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIST, loadPage } from './load';

// The blocks are rendered by the hidden fixture page src/pages/ui-kit/[lang].astro, which only
// exists in the fixture build (UI_KIT=1) and the dev server, never in the production build.
const tr = () => loadPage('/ui-kit/tr/');
const en = () => loadPage('/ui-kit/en/');

describe('ui blocks', () => {
  it('Accordion renders details/summary with the title and an aria-hidden chevron', () => {
    const acc = tr().querySelector('details.acc')!;
    const summary = acc.querySelector('summary')!;
    expect(summary.text).toContain('Sosyal medyada takip et');
    const chevron = summary.querySelector('.chv')!;
    expect(chevron.getAttribute('aria-hidden')).toBe('true');
    expect(chevron.querySelector('svg')).toBeTruthy();
  });

  it('TilePair with one item renders a single full-width tile; with two renders two', () => {
    const pairs = tr().querySelectorAll('.tile-pair');
    const single = pairs.find((p) => p.classList.contains('single'))!;
    expect(single.querySelectorAll('a.tile')).toHaveLength(1);
    const double = pairs.find((p) => !p.classList.contains('single'))!;
    expect(double.querySelectorAll('a.tile')).toHaveLength(2);
  });

  it('PageEnd has the 112 line and the current year, in both languages', () => {
    const year = String(new Date().getFullYear());
    const trEnd = tr().querySelector('.page-end')!;
    expect(trEnd.querySelector('b')?.text).toBe('112');
    expect(trEnd.text).toContain(`© ${year} klinikterapist.com · Tüm hakları saklıdır.`);
    const enEnd = en().querySelector('.page-end')!;
    expect(enEnd.text).toContain('112');
    expect(enEnd.text).toContain(`© ${year} klinikterapist.com · All rights reserved.`);
  });

  it('LangSwitch shows ENG with an svg flag on TR pages and TR on EN pages, never an emoji flag', () => {
    const trSwitch = tr().querySelector('a.lang-switch')!;
    expect(trSwitch.text.trim()).toBe('ENG');
    expect(trSwitch.querySelector('svg')).toBeTruthy();
    expect(trSwitch.getAttribute('href')).toBe('/ui-kit/en/');
    const enSwitch = en().querySelector('a.lang-switch')!;
    expect(enSwitch.text.trim()).toBe('TR');
    expect(enSwitch.querySelector('svg')).toBeTruthy();
    for (const page of [tr(), en()]) {
      expect(page.toString()).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
    }
  });

  it('StickyCta: always is visible from the start, afterTopCta starts hidden', () => {
    const always = tr().querySelector('[data-sticky-cta="always"]')!;
    expect(always.classList.contains('is-hidden')).toBe(false);
    expect(always.getAttribute('aria-hidden')).toBeUndefined();
    const after = en().querySelector('[data-sticky-cta="after"]')!;
    expect(after.classList.contains('is-hidden')).toBe(true);
    expect(after.getAttribute('aria-hidden')).toBe('true');
    expect(en().querySelector('#top-cta')).toBeTruthy();
  });

  it('TopBar: logo, back and none variants; theme chip and language switch on the right', () => {
    const logo = tr().querySelector('.top-bar a.logo')!;
    expect(logo.getAttribute('href')).toBe('/');
    expect(logo.querySelector('svg')).toBeTruthy();
    const back = en().querySelector('.top-bar a.back')!;
    expect(back.getAttribute('href')).toBe('/en/blog/');
    expect(back.text).toContain('Blog');
    expect(tr().querySelector('.top-bar button.theme-chip')).toBeTruthy();
  });

  it('ListItem: chevron, subtitle, external links open safely', () => {
    const items = tr().querySelectorAll('a.list-item');
    expect(items.length).toBeGreaterThan(1);
    expect(items[0].querySelector('.chv svg')).toBeTruthy();
    expect(items[0].querySelector('.subtitle')).toBeTruthy();
    const ext = items.find((i) => i.getAttribute('target') === '_blank')!;
    expect(ext.getAttribute('rel')).toContain('noopener');
  });
});

describe('hidden fixture page stays out of the public site', () => {
  it('is noindex and not in the sitemap', () => {
    expect(tr().querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
    const sitemap = readFileSync(join(DIST, 'sitemap-0.xml'), 'utf8');
    expect(sitemap).not.toContain('ui-kit');
    expect(existsSync(join(DIST, 'sitemap-index.xml'))).toBe(true);
  });
});
