import { describe, expect, it } from 'vitest';
import { citedIds, parseCiteAttr, renderReferencesSection, validateCitations, writeCiteAttr } from '../../src/lib/citations';
import type { Reference } from '../../src/lib/apa';

const RAY: Reference = {
  id: 'ray2004', type: 'article', authors: [{ family: 'Ray', given: 'Oakley' }], year: 2004,
  title: 'How the mind hurts and heals the body', container: 'American Psychologist', volume: '59', issue: '1',
  pages: '29-40', doi: '10.1037/0003-066X.59.1.29',
};
const SMITH: Reference = {
  id: 'smith2010', type: 'book', authors: [{ family: 'Smith', given: 'John' }, { family: 'Lee', given: 'Kim' }],
  year: 2010, title: 'Small steps', publisher: 'Example Press',
};
const RAY_B: Reference = { ...RAY, id: 'ray2004-2', title: 'Another paper', doi: undefined };

describe('parseCiteAttr / writeCiteAttr', () => {
  it('reads ids and locators', () => {
    expect(parseCiteAttr('ray2004;smith2010~p~34')).toEqual([{ id: 'ray2004' }, { id: 'smith2010', locator: { kind: 'p', value: '34' } }]);
    expect(parseCiteAttr('a~pp~10–12;b~para~3;c~ch~2')).toEqual([
      { id: 'a', locator: { kind: 'pp', value: '10–12' } },
      { id: 'b', locator: { kind: 'para', value: '3' } },
      { id: 'c', locator: { kind: 'ch', value: '2' } },
    ]);
  });

  it('returns null for anything else', () => {
    for (const bad of ['', ';', 'a;', 'a~x~1', 'a~p', 'a~p~', 'a~p~1~2', 'a b', 'a"b', 'a~p~<b>', 'a~p~1&2']) {
      expect(parseCiteAttr(bad), bad).toBeNull();
    }
  });

  it('writes the same form and drops characters a locator may not hold', () => {
    expect(writeCiteAttr([{ id: 'ray2004' }, { id: 'smith2010', locator: { kind: 'p', value: '34' } }])).toBe('ray2004;smith2010~p~34');
    expect(writeCiteAttr([{ id: 'a', locator: { kind: 'pp', value: ' 1;2~3"<>&4 ' } }])).toBe('a~pp~1234');
    expect(writeCiteAttr([{ id: 'a', locator: { kind: 'p', value: ';;' } }])).toBe('a');
    const items = [{ id: 'x', locator: { kind: 'para' as const, value: '5' } }];
    expect(parseCiteAttr(writeCiteAttr(items))).toEqual(items);
  });
});

describe('citedIds', () => {
  it('collects the ids of every cite, without duplicates', () => {
    const md =
      'A <cite data-refs="ray2004">(Ray, 2004)</cite> and <cite data-refs="ray2004;smith2010~p~3" data-narrative>Ray (2004) ve Smith ve Lee (2010, s. 3)</cite>.\n';
    expect([...citedIds(md)].sort()).toEqual(['ray2004', 'smith2010']);
  });

  it('ignores escaped text and invalid attributes', () => {
    expect(citedIds('\\<cite data-refs="x">y\\</cite> <cite data-refs="a b">z</cite> <cite class="q" data-refs="w">v</cite>').size).toBe(0);
  });
});

describe('validateCitations', () => {
  it('passes when every cited id is in the list', () => {
    expect(() => validateCitations('<cite data-refs="ray2004">(Ray, 2004)</cite>', [RAY], 'a/tr.md')).not.toThrow();
    expect(() => validateCitations('no cites', [], 'a/tr.md')).not.toThrow();
  });

  it('names the file and the missing id', () => {
    expect(() => validateCitations('<cite data-refs="ray2004;x">(…)</cite>', [RAY], 'a/tr.md')).toThrow(
      'a/tr.md: metinde atıf yapılan "x" referansı kaynak listesinde yok.',
    );
  });
});

describe('renderReferencesSection', () => {
  it('lists only the cited references, APA-sorted, under the language heading', () => {
    const html = renderReferencesSection([SMITH, RAY, RAY_B], new Set(['smith2010', 'ray2004']), 'tr');
    expect(html.startsWith('<section class="references"')).toBe(true);
    expect(html).toContain('<h2 id="references-title">Kaynakça</h2>');
    expect(html).toContain('<ol class="references-list">');
    const items = html.match(/<li>[\s\S]*?<\/li>/g)!;
    expect(items).toHaveLength(2);
    expect(items[0]).toContain('Ray, O. (2004).');
    expect(items[0]).toContain('<a href="https://doi.org/10.1037/0003-066X.59.1.29">');
    expect(items[1]).toContain('Smith, J. ve Lee, K.');
    expect(html).not.toContain('Another paper');
    expect(renderReferencesSection([RAY], new Set(['ray2004']), 'en')).toContain('>References</h2>');
  });

  it('computes 2004a/2004b over the cited references only', () => {
    expect(renderReferencesSection([RAY, RAY_B], new Set(['ray2004']), 'en')).toContain('(2004).');
    expect(renderReferencesSection([RAY, RAY_B], new Set(['ray2004', 'ray2004-2']), 'en')).toContain('(2004a).');
  });

  it('is empty when nothing is cited', () => {
    expect(renderReferencesSection([RAY], new Set(), 'tr')).toBe('');
    expect(renderReferencesSection([], new Set(['ray2004']), 'tr')).toBe('');
  });
});
