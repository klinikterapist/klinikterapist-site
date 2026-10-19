import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { runScheduled } from '../../../apps-script/src/schedule';
import { getDraft, listDrafts, saveDraft } from '../../../apps-script/src/drive';
import { handle, runHourly } from '../../../apps-script/src/main';
import { issueSession } from '../../../apps-script/src/auth';
import { fakeGas } from './fake-gas';
import { FakeGitHub } from './fake-github';
import { completeDraft, ghProps, ghSeed } from './publish-fixtures';

const NOW = Date.parse('2026-10-24T10:30:00+03:00');

function setup() {
  const gh = new FakeGitHub(ghSeed);
  const gas = fakeGas({ props: { ...ghProps, OWNER_EMAIL: 'merhaba@klinikterapist.com' }, routes: [gh.route], now: NOW });
  return { gh, gas };
}

/** A complete draft without images, planned for `at`. */
const planned = (key: string, slug: string, at: string | null) => {
  const d = completeDraft({ key, scheduledAt: at });
  d.tr = { ...d.tr, slug, doc: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Metin.' }] }] } };
  d.en = { ...d.en, slug: `${slug}-en` };
  return d;
};

const githubCalls = (gas: ReturnType<typeof setup>['gas']) => gas.calls.filter((c) => c.url.includes('api.github.com')).length;

describe('runScheduled', () => {
  it('publishes only due drafts', async () => {
    const { gh, gas } = setup();
    saveDraft(gas, { draft: planned('taslak-a', 'gecmis', '2026-10-24T09:30:00+03:00') });
    saveDraft(gas, { draft: planned('taslak-b', 'yarin', '2026-10-25T09:00:00+03:00') });
    saveDraft(gas, { draft: planned('taslak-c', 'plansiz', null) });
    const r = await runScheduled(gas, new Date(NOW));
    expect(r).toEqual({ published: ['taslak-a'], failed: [] });
    expect(gh.text('src/content/posts/gecmis/tr.md')).toContain('title: "Kaygı"');
    expect(() => getDraft(gas, { key: 'taslak-a' })).toThrow();
    expect(getDraft(gas, { key: 'taslak-b' }).draft.scheduledAt).toBe('2026-10-25T09:00:00+03:00');
    expect(gh.files.has('src/content/posts/yarin/tr.md')).toBe(false);
  });

  it('nothing due: no GitHub call', async () => {
    const { gas } = setup();
    saveDraft(gas, { draft: planned('taslak-b', 'yarin', '2026-10-25T09:00:00+03:00') });
    expect(await runScheduled(gas, new Date(NOW))).toEqual({ published: [], failed: [] });
    expect(githubCalls(gas)).toBe(0);
  });

  it('a failing publish keeps the draft and records the error; the next run retries', async () => {
    const { gh, gas } = setup();
    saveDraft(gas, { draft: planned('taslak-a', 'gecmis', '2026-10-24T09:30:00+03:00') });
    gh.status = 500;
    const first = await runScheduled(gas, new Date(NOW));
    expect(first.published).toEqual([]);
    expect(first.failed).toHaveLength(1);
    expect(getDraft(gas, { key: 'taslak-a' }).draft.scheduledAt).toBe('2026-10-24T09:30:00+03:00');
    const summary = listDrafts(gas).drafts.find((d) => d.key === 'taslak-a')!;
    expect(summary.scheduledAt).toBe('2026-10-24T09:30:00+03:00');
    expect(summary.scheduleError).toBe(first.failed[0].message);
    expect(gh.files.has('src/content/posts/gecmis/tr.md')).toBe(false);

    gh.status = 200;
    const second = await runScheduled(gas, new Date(NOW + 3600e3));
    expect(second.published).toEqual(['taslak-a']);
    expect(gas.props.get('sched:err:taslak-a')).toBeNull();
  });

  it('an incomplete planned draft fails with the checklist message and stays', async () => {
    const { gas } = setup();
    const d = planned('taslak-a', 'gecmis', '2026-10-24T09:30:00+03:00');
    d.en = { ...d.en, title: '' };
    saveDraft(gas, { draft: d });
    const r = await runScheduled(gas, new Date(NOW));
    expect(r.failed[0].message).toMatch(/Yayınlamadan önce tamamlayın/);
    expect(getDraft(gas, { key: 'taslak-a' }).draft.scheduledAt).not.toBeNull();
  });

  it('publishedAt becomes the Istanbul day of scheduledAt', async () => {
    const { gh, gas } = setup();
    gas.clock.now = Date.parse('2026-11-01T00:10:00+03:00');
    saveDraft(gas, { draft: planned('taslak-a', 'gece', '2026-10-31T23:30:00+03:00') });
    await runScheduled(gas, new Date(gas.clock.now));
    expect(gh.text('src/content/posts/gece/tr.md')).toContain('\npublishedAt: 2026-10-31\n');
    expect(gh.text('src/content/posts/gece/tr.md')).not.toContain('scheduledAt');
  });

  it('the hourly entry point never throws and logs no draft text', async () => {
    const { gh, gas } = setup();
    saveDraft(gas, { draft: planned('taslak-a', 'gecmis', '2026-10-24T09:30:00+03:00') });
    gh.status = 500;
    await expect(runHourly(gas)).resolves.toBeUndefined();
    expect(gas.logs.join('\n')).not.toContain('Metin.');
  });
});

describe('admin.triggers', () => {
  it('creates the hourly trigger once, for a signed-in owner only', () => {
    const { gas } = setup();
    expect(handle(gas, JSON.stringify({ action: 'admin.triggers' })).ok).toBe(false);
    const { session } = issueSession(gas, 'merhaba@klinikterapist.com');
    expect(handle(gas, JSON.stringify({ action: 'admin.triggers', session })).ok).toBe(true);
    handle(gas, JSON.stringify({ action: 'admin.triggers', session }));
    expect(gas.triggerList).toEqual(['hourly']);
  });
});

describe('bundle', () => {
  it('builds with the hourly shim and parses', () => {
    execFileSync(process.execPath, ['apps-script/build.mjs'], { stdio: 'pipe' });
    const code = readFileSync('apps-script/dist/Code.js', 'utf8');
    expect(code).toContain('function hourly(e) { return App.hourly(e); }');
    expect(() => new Function(code)).not.toThrow();
    expect(code).not.toMatch(/require\(["']node:/);
  });
});
