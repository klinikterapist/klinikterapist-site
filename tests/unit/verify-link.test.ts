// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mountVerifyLink } from '../../src/components/appointment/verify-link';

function card(endpoint: string | null = 'https://api.example/exec') {
  document.body.innerHTML = `
    <section data-verify-card ${endpoint ? `data-endpoint="${endpoint}"` : ''} data-state="idle" hidden tabindex="-1">
      <h2 data-verify-title></h2><p data-verify-text></p>
    </section>`;
  const root = document.querySelector<HTMLElement>('[data-verify-card]')!;
  root.dataset.messages = JSON.stringify({
    checking: { title: 'Kontrol', text: 'Bekleyin' },
    ok: { title: 'Onaylandı', text: 'Teşekkürler' },
    failed: { title: 'Açılamadı', text: 'Yeniden deneyin' },
  });
  return root;
}

const reply = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body)));

describe('the e-mail check link (?dogrula=…)', () => {
  beforeEach(() => history.replaceState(null, '', '/on-gorusme/'));

  it('shows a card at the top that the address is confirmed, and takes the code off the address bar', async () => {
    history.replaceState(null, '', '/on-gorusme/?dogrula=r%3Aabc.def');
    const fetch = reply({ ok: true, data: { verified: true } });
    const root = card();
    const done = mountVerifyLink(root, fetch);
    expect(root.hidden).toBe(false);
    expect(root.dataset.state).toBe('checking');
    // Off the address bar before the answer comes: not kept in history or in a shared address.
    expect(location.search).toBe('');
    await done;
    expect(root.dataset.state).toBe('ok');
    expect(root.querySelector('[data-verify-title]')!.textContent).toBe('Onaylandı');
    expect(root.querySelector('[data-verify-text]')!.textContent).toBe('Teşekkürler');
    expect(JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ action: 'booking.verify', code: 'r:abc.def' });
    expect(document.activeElement).toBe(root);
  });

  it('a refused or unreachable check says so', async () => {
    history.replaceState(null, '', '/randevu/?dogrula=bad');
    const root = card();
    await mountVerifyLink(root, reply({ ok: false, error: { code: 'bad_request', message: 'x' } }));
    expect(root.dataset.state).toBe('failed');
    history.replaceState(null, '', '/randevu/?dogrula=bad');
    const again = card();
    await mountVerifyLink(again, vi.fn(async () => Promise.reject(new Error('offline'))));
    expect(again.dataset.state).toBe('failed');
    expect(again.querySelector('[data-verify-title]')!.textContent).toBe('Açılamadı');
  });

  it('without a code, or without the panel address, the card stays hidden and nothing is sent', async () => {
    const fetch = reply({ ok: true });
    const root = card();
    await mountVerifyLink(root, fetch);
    expect(root.hidden).toBe(true);
    history.replaceState(null, '', '/on-gorusme/?dogrula=r%3Aabc.def');
    const noEndpoint = card(null);
    await mountVerifyLink(noEndpoint, fetch);
    expect(noEndpoint.hidden).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
