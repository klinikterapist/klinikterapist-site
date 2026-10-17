/**
 * "Sürüm geçmişi": earlier saves of this post (newest first). Picking one shows it read-only;
 * "Bu sürüme dön" hands the version back to the editor, which restores only the editing language.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from '../../../lib/schemas';
import { ApiFailure, type Api, type Draft, type VersionSummary } from '../../api/types';
import { normalizeDraft } from '../../lib/draft';
import { renderPreviewHtml } from '../../lib/preview';
import { relativeLabel } from '../../lib/versions';
import { Banner, Button, Dialog, Spinner } from '../kit';

const NEEDS_UPDATE = "Sürüm geçmişi için Apps Script'in güncellenmesi gerekiyor.";

function describe(e: unknown, fallback: string): string {
  if (e instanceof ApiFailure) return e.code === 'bad_request' && e.message.startsWith('Bilinmeyen işlem') ? NEEDS_UPDATE : e.message;
  return fallback;
}

type Props = { api: Api; draftKey: string; lang: Lang; now?: Date; onRestore: (version: Draft) => void; onClose: () => void };

export function VersionsDialog({ api, draftKey, lang, now, onRestore, onClose }: Props) {
  const [list, setList] = useState<VersionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [version, setVersion] = useState<Draft | null>(null);
  const [reading, setReading] = useState(false);
  const latestPick = useRef<string | null>(null);
  const clock = useMemo(() => now ?? new Date(), [now]);

  useEffect(() => {
    let alive = true;
    api
      .listVersions(draftKey)
      .then((r) => alive && setList(r.versions))
      .catch((e) => alive && setError(describe(e, 'Sürümler yüklenemedi. Tekrar deneyin.')));
    return () => {
      alive = false;
    };
  }, [api, draftKey]);

  const pick = (v: VersionSummary) => {
    latestPick.current = v.name;
    setPicked(v.name);
    setVersion(null);
    setError(null);
    setReading(true);
    api
      .getVersion(draftKey, v.name)
      .then((r) => latestPick.current === v.name && setVersion(normalizeDraft(r.draft)))
      .catch((e) => latestPick.current === v.name && setError(describe(e, 'Bu sürüm okunamadı.')))
      .finally(() => latestPick.current === v.name && setReading(false));
  };

  const html = useMemo(() => (version ? renderPreviewHtml(version, lang, () => null) : ''), [version, lang]);
  const langName = lang === 'tr' ? 'Türkçe' : 'İngilizce';

  return (
    <Dialog
      title="Sürüm geçmişi"
      onClose={onClose}
      actions={
        <>
          <Button onClick={onClose}>Kapat</Button>
          {version && (
            <Button variant="primary" onClick={() => onRestore(version)}>
              Bu sürüme dön
            </Button>
          )}
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      {!list && !error && <Spinner label="Sürümler yükleniyor…" />}
      {list && list.length === 0 && <p>Henüz kayıtlı bir önceki sürüm yok.</p>}
      {list && list.length > 0 && (
        <>
          <p className="k-hint">
            Bir sürüme tıklayın, yazının o günkü hâlini görün. Yalnızca şu an düzenlediğiniz dil ({langName}) geri yüklenir; diğer dil ve ayarlar olduğu gibi kalır.
          </p>
          <ul className="versions-list" aria-label="Önceki sürümler">
            {list.map((v) => (
              <li key={v.name}>
                <button type="button" className="versions-item" aria-pressed={picked === v.name} onClick={() => pick(v)}>
                  {relativeLabel(v.savedAt, clock)} <small>sürüm {v.rev}</small>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {reading && <Spinner label="Sürüm açılıyor…" />}
      {version && <div className="versions-view" aria-label={`${langName} metin, salt okunur`} dangerouslySetInnerHTML={{ __html: html }} />}
    </Dialog>
  );
}
