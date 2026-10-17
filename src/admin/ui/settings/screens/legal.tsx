/** Yasal metinler: KVKK aydınlatma metni and privacy policy, TR/EN Markdown files. */
import { useEffect, useState } from 'react';
import { ApiFailure } from '../../../api/types';
import { usePanel } from '../../context';
import { useDeploy } from '../../DeployStatus';
import { Banner, Button, Spinner } from '../../kit';
import { MarkdownField } from '../fields';

const FILES = [
  { path: 'src/data/legal/aydinlatma.tr.md', label: 'Aydınlatma metni (Türkçe)', lang: 'tr' as const },
  { path: 'src/data/legal/aydinlatma.en.md', label: 'Aydınlatma metni (İngilizce)', lang: 'en' as const },
  { path: 'src/data/legal/gizlilik.tr.md', label: 'Gizlilik politikası (Türkçe)', lang: 'tr' as const },
  { path: 'src/data/legal/gizlilik.en.md', label: 'Gizlilik politikası (İngilizce)', lang: 'en' as const },
];

type Loaded = Record<string, { text: string; sha: string; original: string }>;

export function YasalScreen() {
  const { api } = usePanel();
  const deploy = useDeploy();
  const [files, setFiles] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = () =>
    api.read(FILES.map((f) => f.path)).then(({ files: read }) =>
      setFiles(Object.fromEntries(read.map((f) => [f.path, { text: f.content, sha: f.sha, original: f.content }]))),
    );

  useEffect(() => {
    setError(null);
    load().catch((e) => setError(e instanceof ApiFailure ? e.message : 'Metinler yüklenemedi. Tekrar deneyin.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, attempt]);

  const changed = files ? FILES.filter((f) => files[f.path].text !== files[f.path].original) : [];

  const save = async () => {
    if (!files || !changed.length) return;
    setSaving(true);
    setMessage(null);
    try {
      const { commitSha } = await api.commit({
        message: 'Site ayarları: Yasal metinler',
        writes: changed.map((f) => ({
          path: f.path,
          content: files[f.path].text.endsWith('\n') ? files[f.path].text : `${files[f.path].text}\n`,
          encoding: 'utf8' as const,
          expectSha: files[f.path].sha,
        })),
        deletes: [],
      });
      await load();
      deploy.track(commitSha);
      setMessage({ tone: 'success', text: 'Kaydedildi. Site 1–3 dakika içinde güncellenir.' });
    } catch (e) {
      setMessage({
        tone: 'error',
        text: e instanceof ApiFailure && e.code === 'conflict' ? 'Bu metin başka bir yerde değişmiş. Sayfayı yenileyip tekrar deneyin.' : e instanceof Error ? e.message : 'Kaydedilemedi.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="settings" aria-labelledby="legal-title">
      <div className="screen-head">
        <h2 id="legal-title">Yasal metinler</h2>
      </div>
      <p className="settings-intro">KVKK metinlerinin hukuki içeriği sizin sorumluluğunuzdadır. Metinler sitede ilgili sayfalarda yayınlanır.</p>
      {error && (
        <Banner tone="error" action={<Button onClick={() => setAttempt(attempt + 1)}>Tekrar dene</Button>}>
          {error}
        </Banner>
      )}
      {!files && !error && <Spinner />}
      {files && (
        <form
          className="settings-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {FILES.map((f) => (
            <MarkdownField
              key={f.path}
              label={f.label}
              lang={f.lang}
              rows={14}
              value={files[f.path].text}
              onChange={(text) => setFiles({ ...files, [f.path]: { ...files[f.path], text } })}
            />
          ))}
          <div className="save-bar">
            {message && <Banner tone={message.tone}>{message.text}</Banner>}
            <Button type="submit" variant="primary" busy={saving} disabled={!changed.length}>
              Kaydet
            </Button>
            {changed.length > 0 && !saving && <span className="k-hint">{changed.length} metinde kaydedilmemiş değişiklik var.</span>}
          </div>
        </form>
      )}
    </section>
  );
}
