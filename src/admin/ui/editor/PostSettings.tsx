/** Post settings: shared (category, cover, date) and per language (URL, SEO title, description, keyword). */
import { useEffect, useRef, useState } from 'react';
import type { Draft, LangFields } from '../../api/types';
import type { Category, Lang } from '../../../lib/schemas';
import { slugError } from '../../../lib/schemas';
import { slugify } from '../../../lib/slug';
import { postPath } from '../../../i18n/routes';
import { LANG_LABEL } from '../../lib/draft';
import { IMAGE_PRESETS, ImageError, resizeImage } from '../../lib/image';
import { Button, Field, Select } from '../kit';
import type { ImageStore } from './images';

export const COVER_NAME = 'cover.webp';

/** Like slugify, but keeps a trailing dash so the owner can type "kaygi-ile". */
export const typingSlug = (v: string, lang: Lang) => slugify(`${v}x`, lang).slice(0, -1);

export function PostSettings(props: {
  draft: Draft;
  lang: Lang;
  categories: Category[];
  images: ImageStore;
  /** Bumped after a new cover upload so the preview reloads. */
  coverVersion: number;
  onShared: (patch: Partial<Pick<Draft, 'category' | 'cover' | 'publishedAt'>>) => void;
  onLang: (patch: Partial<LangFields>) => void;
  onCoverUploaded: () => void;
  onError: (message: string | null) => void;
}) {
  const { draft, lang, categories, images } = props;
  const f = draft[lang];
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    if (draft.cover) images.url(draft.cover).then((u) => alive && setCover(u));
    else setCover(null);
    return () => {
      alive = false;
    };
  }, [draft.cover, images, props.coverVersion]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    props.onError(null);
    try {
      const img = await resizeImage(file, IMAGE_PRESETS.cover);
      await images.add(COVER_NAME, img.base64);
      props.onShared({ cover: COVER_NAME });
      props.onCoverUploaded();
    } catch (e) {
      props.onError(e instanceof ImageError ? e.message : 'Kapak görseli yüklenemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const slugProblem = f.slug ? slugError(f.slug, lang) : null;

  return (
    <section className="side-card" aria-labelledby="settings-title">
      <h3 id="settings-title">Yazı ayarları</h3>
      <div className="stack">
        <Select
          label="Kategori"
          value={draft.category}
          options={[{ value: '', label: 'Kategori seçin…' }, ...categories.map((c) => ({ value: c.id, label: c.label.tr }))]}
          onChange={(category) => props.onShared({ category })}
        />
        <Field label="Yayın tarihi" type="date" value={draft.publishedAt} onChange={(publishedAt) => publishedAt && props.onShared({ publishedAt })} hint="Yazıda görünen tarih. Yazı, Yayınla'ya bastığınızda yayınlanır." />
        <div className="k-field">
          <span className="k-label">Kapak görseli (iki dil için ortak)</span>
          {cover && <img className="cover-preview" src={cover} alt="" />}
          <div className="row">
            <Button busy={busy} onClick={() => input.current?.click()}>
              {draft.cover ? 'Kapağı değiştir' : 'Kapak görseli ekle'}
            </Button>
            {draft.cover && (
              <Button variant="ghost" onClick={() => props.onShared({ cover: null })}>
                Kapağı kaldır
              </Button>
            )}
          </div>
          <input ref={input} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </div>

      <h4 className="side-sub">{LANG_LABEL[lang]} ayarları</h4>
      <div className="stack">
        <Field
          label="URL kısa adı"
          value={f.slug}
          onChange={(v) => props.onLang({ slug: typingSlug(v, lang), slugTouched: true })}
          hint={
            <>
              klinikterapist.com{postPath(f.slug || '…', lang)}
              {f.slugTouched && (
                <>
                  {' · '}
                  <button type="button" className="linklike" onClick={() => props.onLang({ slug: slugify(f.title, lang), slugTouched: false })}>
                    Başlıktan üret
                  </button>
                </>
              )}
            </>
          }
          error={slugProblem}
        />
        {draft.published && (
          <p className="k-hint">Yayındaki yazının adresini değiştirirseniz eski adres yeni adrese otomatik yönlendirilir.</p>
        )}
        <Field label="SEO başlığı (isteğe bağlı)" value={f.seoTitle} onChange={(seoTitle) => props.onLang({ seoTitle })} hint="Boş bırakırsanız yazı başlığı kullanılır." lang={lang} />
        <Field
          label="Meta açıklama"
          multiline
          rows={3}
          value={f.description}
          onChange={(description) => props.onLang({ description })}
          hint={`${f.description.trim().length} karakter · Google'da başlığın altında görünür (120–158 ideal).`}
          lang={lang}
        />
        <Field label="Odak kelime" value={f.focusKeyword} onChange={(focusKeyword) => props.onLang({ focusKeyword })} hint="Bu yazının Google'da bulunmasını istediğiniz kelime ya da ifade." lang={lang} />
        {draft.cover && <Field label="Kapak görselinin alt metni" value={f.coverAlt} onChange={(coverAlt) => props.onLang({ coverAlt })} hint="Görselde ne var? Kısa bir cümle." lang={lang} />}
      </div>
    </section>
  );
}
