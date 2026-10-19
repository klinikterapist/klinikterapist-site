/**
 * Meta panel for the active language: what search engines and share cards show (URL, SEO title,
 * description) with the Google and social previews next to the fields.
 */
import { useEffect, useState } from 'react';
import type { Draft, LangFields } from '../../api/types';
import type { Lang } from '../../../lib/schemas';
import { slugError } from '../../../lib/schemas';
import { slugify } from '../../../lib/slug';
import { postPath } from '../../../i18n/routes';
import { LANG_LABEL } from '../../lib/draft';
import { truncateToWidth } from '../../lib/text-width';
import { HELP } from '../../lib/help-texts';
import { Field } from '../kit';
import type { ImageStore } from './images';

/** Like slugify, but keeps a trailing dash so the owner can type "kaygi-ile". */
export const typingSlug = (v: string, lang: Lang) => slugify(`${v}x`, lang).slice(0, -1);

const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

function SerpPreview({ lang, title, slug, description }: { lang: Lang; title: string; slug: string; description: string }) {
  const [mobile, setMobile] = useState(false);
  const crumbs = lang === 'tr' ? ['blog', slug || '…'] : ['en', 'blog', slug || '…'];
  return (
    <section className="serp" aria-label="Google önizlemesi">
      <div className="serp-head">
        <h4>Google'da görünüm</h4>
        <div className="row" role="group" aria-label="Önizleme cihazı">
          <button type="button" className={`chip ${!mobile ? 'is-active' : ''}`} aria-pressed={!mobile} onClick={() => setMobile(false)}>
            Masaüstü
          </button>
          <button type="button" className={`chip ${mobile ? 'is-active' : ''}`} aria-pressed={mobile} onClick={() => setMobile(true)}>
            Mobil
          </button>
        </div>
      </div>
      <div className={`serp-card ${mobile ? 'is-mobile' : ''}`}>
        <p className="serp-url">klinikterapist.com › {crumbs.join(' › ')}</p>
        <p className="serp-title">{truncateToWidth(title || 'Başlık', mobile ? 500 : 580)}</p>
        <p className="serp-desc">{cut(description || 'Meta açıklama yazın; Google burada gösterir.', mobile ? 120 : 158)}</p>
      </div>
    </section>
  );
}

function SocialPreview({ title, description, image, siteName }: { title: string; description: string; image: string | null; siteName?: string }) {
  return (
    <section className="social" aria-label="Paylaşım önizlemesi">
      <h4>Paylaşınca görünüm</h4>
      <div className="social-card">
        {image ? <img src={image} alt="" /> : <div className="social-noimg">Varsayılan paylaşım görseli</div>}
        <div className="social-text">
          <p className="social-site">KLINIKTERAPIST.COM</p>
          {siteName && <p className="social-name">{siteName}</p>}
          <p className="social-title">{cut(title || 'Başlık', 70)}</p>
          <p className="social-desc">{cut(description, 110)}</p>
        </div>
      </div>
      <p className="k-hint">Bazı uygulamalar site adını gösterir, bazıları yalnızca adresi.</p>
    </section>
  );
}

export function MetaPanel(props: { draft: Draft; lang: Lang; images: ImageStore; siteName?: string; onLang: (patch: Partial<LangFields>) => void }) {
  const { draft, lang, images } = props;
  const f = draft[lang];
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (draft.cover) images.url(draft.cover).then((u) => alive && setCover(u));
    else setCover('/og-default.jpg');
    return () => {
      alive = false;
    };
  }, [draft.cover, draft.coverCrop, images]);

  const slugProblem = f.slug ? slugError(f.slug, lang) : null;
  const title = (f.seoTitle || f.title).trim();

  return (
    <div className="rail-panel-body">
      <h3>Meta ({LANG_LABEL[lang]})</h3>
      <div className="stack">
        <Field
          label="URL kısa adı"
          field="slug"
          help={HELP.slug}
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
        {draft.published && <p className="k-hint">Yayındaki yazının adresini değiştirirseniz eski adres yeni adrese otomatik yönlendirilir.</p>}
        <Field
          label="SEO başlığı (isteğe bağlı)"
          field="seoTitle"
          help={HELP.seoTitle}
          value={f.seoTitle}
          onChange={(seoTitle) => props.onLang({ seoTitle })}
          hint="Boş bırakırsanız yazı başlığı kullanılır."
          lang={lang}
        />
        <Field
          label="Meta açıklama"
          field="description"
          help={HELP.description}
          multiline
          rows={3}
          value={f.description}
          onChange={(description) => props.onLang({ description })}
          hint={`${f.description.trim().length} karakter · Google'da başlığın altında görünür (120–158 ideal).`}
          lang={lang}
        />
      </div>
      <SerpPreview lang={lang} title={title} slug={f.slug} description={f.description.trim()} />
      <SocialPreview title={title} description={f.description.trim()} image={cover} siteName={props.siteName} />
    </div>
  );
}
