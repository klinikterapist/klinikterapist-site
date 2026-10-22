/**
 * Sign-in, two locks (owner's decision 2026-10-22): the panel's user name and password first, then
 * Google (Identity Services). The page never names the owner's account and Google does not pick
 * one by itself. Until a password is set, Google alone signs in and the panel asks for one.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MOCK_API_URL } from '../config';
import { ApiFailure, type Session } from '../api/types';
import { usePanel } from './context';
import { Banner, Button, Field } from './kit';

type Gis = {
  accounts: {
    id: {
      initialize(opts: Record<string, unknown>): void;
      renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
      prompt(): void;
    };
  };
};
declare global {
  interface Window {
    google?: Gis;
  }
}

let gisPromise: Promise<Gis> | null = null;
function loadGis(): Promise<Gis> {
  gisPromise ??= new Promise((resolve, reject) => {
    if (window.google?.accounts) return resolve(window.google);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error('gis')));
    s.onerror = () => {
      gisPromise = null;
      reject(new Error('gis'));
    };
    document.head.append(s);
  });
  return gisPromise;
}

const message = (e: unknown) => (e instanceof ApiFailure ? e.message : 'Giriş yapılamadı. Biraz sonra tekrar deneyin.');

export function Login({ again = false, onSignedIn }: { again?: boolean; onSignedIn?: (s: Session) => void }) {
  const { api, config, store } = usePanel();
  const button = useRef<HTMLDivElement>(null);
  /** `start`: asking the backend whether a password is set. */
  const [phase, setPhase] = useState<'start' | 'password' | 'google'>('start');
  const [hasPassword, setHasPassword] = useState(true);
  const step = useRef<string | undefined>(undefined);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mock = config.apiUrl === MOCK_API_URL;

  useEffect(() => {
    let alive = true;
    api.loginStart().then(
      (r) => {
        if (!alive) return;
        setHasPassword(r.password);
        setPhase(r.password ? 'password' : 'google');
      },
      // Unknown: ask for the password; the backend answers if none is set.
      () => alive && setPhase('password'),
    );
    return () => {
      alive = false;
    };
  }, [api]);

  const back = (why: string | null) => {
    step.current = undefined;
    setPassword('');
    setError(why);
    setPhase(hasPassword ? 'password' : 'google');
  };

  const signIn = async (idToken: string) => {
    setBusy(true);
    setError(null);
    try {
      const s = await api.login(idToken, step.current);
      store.set(s.session, s.expiresAt);
      onSignedIn?.(s);
    } catch (e) {
      back(message(e));
    } finally {
      setBusy(false);
    }
  };
  const signInRef = useRef(signIn);
  signInRef.current = signIn;

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Kullanıcı adınızı ve şifrenizi girin.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      step.current = (await api.loginPassword(username, password)).step;
      setPassword('');
      setPhase('google');
    } catch (err) {
      setPassword('');
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (mock || phase !== 'google') return;
    let alive = true;
    loadGis().then(
      (g) => {
        if (!alive || !button.current) return;
        // No login_hint, no auto-select and no One Tap: the owner picks the account.
        g.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (r: { credential?: string }) => r.credential && signInRef.current(r.credential),
          auto_select: false,
          ux_mode: 'popup',
          itp_support: true,
        });
        g.accounts.id.renderButton(button.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'tr' });
      },
      () => alive && setError('Google giriş düğmesi yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.'),
    );
    return () => {
      alive = false;
    };
  }, [mock, phase, config.googleClientId]);

  const intro = again
    ? 'Oturumunuzun süresi doldu. Ekrandaki değişiklikleriniz duruyor; giriş yaptıktan sonra kaldığınız yerden devam edin.'
    : 'Yazılarınızı ve site ayarlarınızı buradan yönetirsiniz.';

  return (
    <section className={`login ${again ? '' : 'card-panel'}`} aria-labelledby="login-title">
      <h2 id="login-title">{again ? 'Yeniden giriş' : 'Giriş'}</h2>
      <p>{intro}</p>
      {phase === 'password' && (
        <form className="login-form" onSubmit={submitPassword} noValidate>
          <p className="login-step">1. adım: kullanıcı adınız ve şifreniz</p>
          <Field label="Kullanıcı adı" value={username} onChange={setUsername} autoComplete="username" />
          <Field label="Şifre" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
          <Button type="submit" variant="primary" busy={busy}>
            Devam
          </Button>
        </form>
      )}
      {phase === 'google' && (
        <div className="login-form">
          <p className="login-step">{hasPassword ? '2. adım: Google hesabınızla doğrulayın' : 'Google hesabınızla giriş yapın'}</p>
          {mock ? (
            <Button variant="primary" busy={busy} onClick={() => signIn('mock')}>
              Deneme girişi (geliştirme)
            </Button>
          ) : (
            <div ref={button} className="login-button" aria-busy={busy || undefined} />
          )}
          {hasPassword && (
            <Button variant="ghost" onClick={() => back(null)} disabled={busy}>
              Geri
            </Button>
          )}
        </div>
      )}
      {error && <Banner tone="error">{error}</Banner>}
    </section>
  );
}
