/**
 * Against a mistyped e-mail address on the site's forms (owner's request 2026-10-20): a "did you
 * mean …?" hint under the address when its domain is a near miss of a common one (one tap fixes
 * it), and the address typed twice — the second field stays invalid (so the step cannot go on)
 * until both match.
 *
 * Markup: [data-email] the address, [data-email-hint] under it, [data-email-again] the repeat,
 * [data-email-mismatch] under the repeat.
 */
import { sameEmail, suggestEmail } from '../../lib/email-check';

const T = {
  tr: { mean: 'Bunu mu demek istediniz:', fix: 'Düzelt', mismatch: 'İki e-posta adresi aynı değil.' },
  en: { mean: 'Did you mean', fix: 'Fix it', mismatch: 'The two e-mail addresses do not match.' },
};

export function mountEmailGuard(scope: HTMLElement, lang: 'tr' | 'en'): void {
  const email = scope.querySelector<HTMLInputElement>('[data-email]');
  const again = scope.querySelector<HTMLInputElement>('[data-email-again]');
  const hint = scope.querySelector<HTMLElement>('[data-email-hint]');
  const mismatch = scope.querySelector<HTMLElement>('[data-email-mismatch]');
  if (!email) return;
  const t = T[lang];

  const suggest = () => {
    if (!hint) return;
    const better = suggestEmail(email.value);
    hint.hidden = !better;
    hint.replaceChildren();
    if (!better) return;
    const fix = document.createElement('button');
    fix.type = 'button';
    fix.className = 'email-fix';
    fix.textContent = t.fix;
    fix.addEventListener('click', () => {
      email.value = better;
      email.dispatchEvent(new Event('input', { bubbles: true }));
      email.focus();
    });
    hint.append(`${t.mean} `, Object.assign(document.createElement('b'), { textContent: better }), lang === 'en' ? '? ' : ' ', fix);
  };

  const check = (show: boolean) => {
    if (!again) return;
    const bad = again.value.trim() !== '' && !sameEmail(email.value, again.value);
    again.setCustomValidity(bad ? t.mismatch : '');
    if (mismatch) {
      mismatch.textContent = t.mismatch;
      mismatch.hidden = !(bad && show);
    }
  };

  email.addEventListener('blur', suggest);
  email.addEventListener('input', () => {
    if (hint && !hint.hidden) suggest();
    check(false);
  });
  again?.addEventListener('input', () => check(false));
  again?.addEventListener('blur', () => check(true));
}
