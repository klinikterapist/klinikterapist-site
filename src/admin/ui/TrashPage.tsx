/**
 * Çöp kutusu (owner's request 2026-10-19): deleted drafts wait here for 30 days. Each row shows when
 * it was deleted and how many days are left, with "Geri al" (back to drafts) and "Kalıcı sil".
 * Anything past 30 days is removed for good by the backend when this list is read.
 */
import { useEffect, useState } from 'react';
import { ApiFailure, type TrashItem } from '../api/types';
import { go, usePanel } from './context';
import { Trash2 } from './icons';
import { Banner, Button, Dialog, EmptyState, Spinner } from './kit';

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysLeft(item: Pick<TrashItem, 'purgeAt'>, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(item.purgeAt) - now) / DAY_MS));
}

export function TrashPage() {
  const { api } = usePanel();
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<TrashItem | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    api
      .listTrash()
      .then(({ items }) => alive && setItems(items))
      .catch((e) => alive && setError(e instanceof ApiFailure ? e.message : 'Çöp kutusu yüklenemedi. Tekrar deneyin.'));
    return () => {
      alive = false;
    };
  }, [api, attempt]);

  const restore = async (item: TrashItem) => {
    setBusy(item.key);
    setNotice(null);
    try {
      await api.restoreTrash(item.key);
      setItems((list) => (list ?? []).filter((x) => x.key !== item.key));
      setNotice(`“${item.title.tr || 'Başlıksız'}” taslaklara geri alındı.`);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Geri alınamadı. Tekrar deneyin.');
    } finally {
      setBusy(null);
    }
  };

  const purge = async (item: TrashItem) => {
    setBusy(item.key);
    setNotice(null);
    try {
      await api.purgeTrash(item.key);
      setItems((list) => (list ?? []).filter((x) => x.key !== item.key));
      setNotice(`“${item.title.tr || 'Başlıksız'}” kalıcı olarak silindi.`);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Silinemedi. Tekrar deneyin.');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  const now = Date.now();
  return (
    <section aria-labelledby="trash-title">
      <div className="screen-head">
        <h2 id="trash-title">Silinen Yazılar</h2>
      </div>
      <p className="screen-lead">Silinen taslaklar burada 30 gün durur; sonra kalıcı olarak silinir. Bu süre içinde istediğinizi geri alabilirsiniz.</p>
      {notice && (
        <Banner tone="success" action={<Button onClick={() => go('#/yazilar/taslaklar')}>Taslaklara git</Button>}>
          {notice}
        </Banner>
      )}
      {error && (
        <Banner tone="error" action={<Button onClick={() => setAttempt(attempt + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!items && !error && <Spinner label="Çöp kutusu yükleniyor…" />}
      {items && items.length === 0 && <EmptyState icon={Trash2}>Çöp kutusu boş.</EmptyState>}
      {items && items.length > 0 && (
        <ul className="post-rows trash-rows">
          {items.map((item) => {
            const left = daysLeft(item, now);
            return (
              <li key={item.key} className="trash-row">
                <span className="trash-text">
                  <span className="post-row-title">{item.title.tr || item.title.en || 'Başlıksız taslak'}</span>
                  <span className="post-row-meta">
                    <span>Silinme: {new Date(item.deletedAt).toLocaleDateString('tr-TR')}</span>
                    <span className={left <= 3 ? 'trash-soon' : undefined}>{left === 0 ? 'Bugün kalıcı olarak silinecek' : `${left} gün sonra kalıcı olarak silinecek`}</span>
                  </span>
                </span>
                <span className="trash-actions">
                  <Button busy={busy === item.key} disabled={busy !== null} onClick={() => restore(item)}>
                    Geri al
                  </Button>
                  <Button variant="ghost" disabled={busy !== null} onClick={() => setConfirm(item)}>
                    Kalıcı sil
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {confirm && (
        <Dialog
          title="Kalıcı olarak silinsin mi?"
          history
          onClose={() => busy === null && setConfirm(null)}
          actions={
            <>
              <Button onClick={() => setConfirm(null)} disabled={busy !== null}>
                Vazgeç
              </Button>
              <Button variant="danger" busy={busy === confirm.key} onClick={() => purge(confirm)}>
                Evet, kalıcı sil
              </Button>
            </>
          }
        >
          <p>“{confirm.title.tr || 'Başlıksız taslak'}” ve görselleri silinecek. Bu işlem geri alınamaz.</p>
        </Dialog>
      )}
    </section>
  );
}
