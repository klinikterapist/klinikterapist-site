/**
 * Live SEO panel for the active language (spec §8.2): score, lights with tips, Google preview
 * (desktop / mobile) and social share preview. Advice only: nothing here blocks publishing.
 */
import { useEffect, useState } from 'react';
import type { Draft } from '../../api/types';
import type { Lang } from '../../../lib/schemas';
import { LANG_LABEL } from '../../lib/draft';
import { runSeoChecks, type SeoCheck } from '../../lib/seo-check';
import { truncateToWidth } from '../../lib/text-width';
import { Light } from '../kit';
import type { ImageStore } from './images';

const cut = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`);

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    if (ms <= 0) return setV(value);
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return ms <= 0 ? value : v;
}

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

function SocialPreview({ title, description, image }: { title: string; description: string; image: string | null }) {
  return (
    <section className="social" aria-label="Paylaşım önizlemesi">
      <h4>Paylaşınca görünüm</h4>
      <div className="social-card">
        {image ? <img src={image} alt="" /> : <div className="social-noimg">Varsayılan paylaşım görseli</div>}
        <div className="social-text">
          <p className="social-site">KLINIKTERAPIST.COM</p>
          <p className="social-title">{cut(title || 'Başlık', 70)}</p>
          <p className="social-desc">{cut(description, 110)}</p>
        </div>
      </div>
    </section>
  );
}

export function SeoPanel(props: { lang: Lang; draft: Draft; otherKeywords: string[]; images: ImageStore; delayMs?: number }) {
  const { lang, images } = props;
  const draft = useDebounced(props.draft, props.delayMs ?? 300);
  const f = draft[lang];
  const { checks, score } = runSeoChecks({ lang, fields: f, hasCover: !!draft.cover, otherKeywords: props.otherKeywords });
  const [cover, setCover] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (draft.cover) images.url(draft.cover).then((u) => alive && setCover(u));
    else setCover('/og-default.jpg');
    return () => {
      alive = false;
    };
  }, [draft.cover, images]);

  const order: Record<SeoCheck['level'], number> = { red: 0, yellow: 1, green: 2 };
  const sorted = [...checks].sort((a, b) => order[a.level] - order[b.level]);
  const tone = score >= 80 ? 'good' : score >= 50 ? 'ok' : 'bad';
  const title = (f.seoTitle || f.title).trim();

  return (
    <section className="side-card seo-panel" aria-labelledby="seo-title">
      <h3 id="seo-title">SEO ({LANG_LABEL[lang]})</h3>
      <div className="seo-score">
        <div
          className={`score-ring score-${tone}`}
          role="meter"
          aria-label="SEO puanı"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          style={{ ['--score' as string]: score }}
        >
          <span>{score}</span>
        </div>
        <p className="k-hint">Kırmızı ışıklar yayını engellemez; yalnızca öneridir.</p>
      </div>
      <ul className="seo-checks">
        {sorted.map((c) => (
          <li key={c.id}>
            <Light level={c.level} />
            <div>
              <p className="seo-label">{c.label}</p>
              {c.level !== 'green' && <p className="seo-tip">{c.tip}</p>}
            </div>
          </li>
        ))}
      </ul>
      <SerpPreview lang={lang} title={title} slug={f.slug} description={f.description.trim()} />
      <SocialPreview title={title} description={f.description.trim()} image={cover} />
    </section>
  );
}
