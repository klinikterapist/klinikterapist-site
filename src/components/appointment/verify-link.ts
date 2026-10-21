/**
 * The e-mail check link (`?dogrula=…`) in a request's or "Haber et" acknowledgement. It opens the
 * booking or intro-call page; the card at the top of the page (VerifyCard.astro) says at once that
 * the address is being checked, then that it is confirmed, or that the link could not be opened.
 * Before, the result was written inside the form, which the intro-call page keeps closed at first,
 * so a visitor saw the ordinary page and no answer (owner's test, 2026-10-22).
 */
type State = 'checking' | 'ok' | 'failed';
export type VerifyMessages = Record<State, { title: string; text: string }>;

export async function mountVerifyLink(root: HTMLElement, fetchFn: typeof fetch = window.fetch.bind(window)): Promise<void> {
  const code = new URLSearchParams(location.search).get('dogrula');
  const endpoint = root.dataset.endpoint ?? '';
  if (!code || !endpoint) return;
  const messages = JSON.parse(root.dataset.messages ?? '{}') as VerifyMessages;
  const show = (state: State) => {
    root.dataset.state = state;
    root.querySelector('[data-verify-title]')!.textContent = messages[state].title;
    root.querySelector('[data-verify-text]')!.textContent = messages[state].text;
  };
  // Off the address bar at once: not kept in the history, not in a shared or bookmarked address.
  history.replaceState(null, '', location.pathname);
  show('checking');
  root.hidden = false;
  root.focus();
  root.scrollIntoView?.({ block: 'start' });
  let ok = false;
  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'booking.verify', code }),
      credentials: 'omit',
    });
    ok = ((await res.json()) as { ok?: boolean })?.ok === true;
  } catch {
    ok = false;
  }
  show(ok ? 'ok' : 'failed');
}
