/** Sign-in with Google (Identity Services). Only the owner's account gets a session. */
import { useEffect, useRef, useState } from 'react';
import { MOCK_API_URL } from '../config';
import { ApiFailure } from '../api/types';
import { usePanel } from './context';
import { Banner, Button } from './kit';

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

export function Login() {
  const { api, config, store } = usePanel();
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mock = config.apiUrl === MOCK_API_URL;

  const signIn = async (idToken: string) => {
    setBusy(true);
    setError(null);
    try {
      const s = await api.login(idToken);
      store.set(s.session, s.expiresAt);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Giriş yapılamadı. Biraz sonra tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (mock) return;
    let alive = true;
    loadGis().then(
      (g) => {
        if (!alive || !button.current) return;
        g.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: (r: { credential?: string }) => r.credential && signIn(r.credential),
          auto_select: true,
          ux_mode: 'popup',
          itp_support: true,
          login_hint: config.ownerEmail,
        });
        g.accounts.id.renderButton(button.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'tr' });
        g.accounts.id.prompt();
      },
      () => alive && setError('Google giriş düğmesi yüklenemedi. İnternet bağlantınızı kontrol edip sayfayı yenileyin.'),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mock, config.googleClientId]);

  return (
    <section className="login card-panel" aria-labelledby="login-title">
      <h2 id="login-title">Giriş</h2>
      <p>Yazılarınızı ve site ayarlarınızı buradan yönetirsiniz. Devam etmek için {config.ownerEmail} hesabınızla giriş yapın.</p>
      {mock ? (
        <Button variant="primary" busy={busy} onClick={() => signIn('mock')}>
          Deneme girişi (geliştirme)
        </Button>
      ) : (
        <div ref={button} className="login-button" aria-busy={busy || undefined} />
      )}
      {error && <Banner tone="error">{error}</Banner>}
    </section>
  );
}
