/**
 * After each commit: "Site güncelleniyor…" until the GitHub Actions run for that commit ends.
 * Also warns 30 days before the GitHub token expires.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Api, SiteStatus } from '../api/types';
import { Banner } from './kit';

type Deploy = { track: (commitSha: string) => void };
const DeployContext = createContext<Deploy>({ track: () => {} });
export const useDeploy = () => useContext(DeployContext);

const DAY = 24 * 3600 * 1000;

export function DeployProvider({ api, children, intervalMs = 15000 }: { api: Api; children: ReactNode; intervalMs?: number }) {
  const [tracking, setTracking] = useState<string | null>(null);
  const [status, setStatus] = useState<SiteStatus | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.status().then(
      (s) => setTokenExpiresAt(s.tokenExpiresAt),
      () => {},
    );
  }, [api]);

  useEffect(() => {
    if (!tracking) return;
    let stopped = false;
    const poll = async () => {
      try {
        const s = await api.status();
        if (stopped) return;
        setStatus(s);
        setTokenExpiresAt(s.tokenExpiresAt);
        if (s.commitSha === tracking && (s.state === 'success' || s.state === 'failure')) {
          setTracking(null);
          return;
        }
      } catch {
        // Keep trying: the site may still be building.
      }
      if (!stopped) timer.current = setTimeout(poll, intervalMs);
    };
    timer.current = setTimeout(poll, intervalMs);
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [api, tracking, intervalMs]);

  // "Yayında ✓" is good news, not a state to keep on screen.
  useEffect(() => {
    if (tracking || status?.state !== 'success') return;
    const t = setTimeout(() => setStatus(null), 10000);
    return () => clearTimeout(t);
  }, [tracking, status]);

  const track = useCallback((sha: string) => {
    setStatus(null);
    setTracking(sha);
  }, []);

  const expiresSoon = tokenExpiresAt && new Date(tokenExpiresAt).getTime() - Date.now() < 30 * DAY;

  return (
    <DeployContext.Provider value={{ track }}>
      <div className="deploy-status" aria-live="polite">
        {tracking && <Banner>Site güncelleniyor (1–3 dk)… Bu sırada çalışmaya devam edebilirsiniz.</Banner>}
        {!tracking && status?.state === 'success' && <Banner tone="success">Yayında ✓ Değişiklikleriniz sitede.</Banner>}
        {!tracking && status?.state === 'failure' && (
          <Banner
            tone="error"
            action={
              status.url ? (
                <a className="k-btn k-btn-ghost" href={status.url} target="_blank" rel="noreferrer">
                  Ayrıntı
                </a>
              ) : undefined
            }
          >
            Yayın başarısız oldu. Sitede eski sürüm duruyor; bana (geliştiriciye) haber verin.
          </Banner>
        )}
        {expiresSoon && (
          <Banner tone="warning">
            GitHub bağlantı anahtarının süresi {new Date(tokenExpiresAt!).toLocaleDateString('tr-TR')} tarihinde doluyor. Kurulum rehberindeki
            &quot;GitHub anahtarı&quot; adımıyla yenileyin.
          </Banner>
        )}
      </div>
      {children}
    </DeployContext.Provider>
  );
}
