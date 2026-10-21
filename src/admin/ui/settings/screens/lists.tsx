/** Site Ana Sayfası (cards), Sosyal Bağlantılar, Kaynaklar: editors over one JSON file each. */
import { useState } from 'react';
import {
  PAGE_KEYS,
  parseHome,
  parseLinks,
  parseResources,
  type Home,
  type HomeCard,
  type Link,
  type Resources,
  type Resource,
} from '../../../../lib/schemas';
import { ICONS, type IconName } from '../../../../lib/icons';
import { Field, Select, Toggle } from '../../kit';
import { ImageField, LocalizedField, SettingsForm } from '../fields';
import { RowList, SiteIcon } from '../rows';
import { useSettingsFile } from '../useSettingsFile';

type ProcessStep = NonNullable<Home['process']>[number];

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

export const PAGE_LABEL: Record<(typeof PAGE_KEYS)[number], string> = {
  home: 'Ana sayfa',
  about: 'Hakkımda',
  blog: 'Blog',
  resources: 'Kaynaklar',
  contact: 'İletişim',
  appointment: 'Randevu',
  preConsult: 'Ön görüşme',
  privacyNotice: 'Aydınlatma metni',
  privacyPolicy: 'Gizlilik politikası',
  faq: 'Sık sorulan sorular',
  popular: 'Popüler yazılar',
  topics: 'Konular',
};
export const ICON_OPTIONS = Object.keys(ICONS).map((k) => ({ value: k, label: k }));

/**
 * The Simge select with the chosen icon drawn next to it (a native select cannot show SVG). The
 * markup is the site's own icon table from src/lib/icons.ts, a fixed string constant in the repo.
 */
export function IconSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const name = (value in ICONS ? value : 'leaf') as IconName;
  return (
    <div className="icon-pick">
      <Select label="Simge" value={value} options={options} onChange={onChange} />
      <svg
        className="icon-preview"
        data-icon={name}
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        dangerouslySetInnerHTML={{ __html: ICONS[name] }}
      />
    </div>
  );
}

/**
 * Site Ana Sayfası (owner's review 2026-10-21): the home page has a fixed layout, so only its texts
 * change here. The cards and the steps show as rows like the page shows them; a row opens its texts
 * (and where the card leads) in a window.
 */
export function AnaSayfaScreen() {
  const file = useSettingsFile<Home>('src/data/home.json', parseHome, 'Site Ana Sayfası');
  const targetName = (c: HomeCard) => ('url' in c.target ? 'Dış bağlantı' : PAGE_LABEL[(c.target as { page: (typeof PAGE_KEYS)[number] }).page]);
  return (
    <SettingsForm title="Site Ana Sayfası" screen="ana-sayfa" file={file}>
      {(h) => (
        <>
          <h3>Kartlar</h3>
          <p className="k-hint">Randevu düğmesinin altında, sırasıyla görünen kartlar. Bir karta basıp metnini ve gideceği yeri değiştirebilirsiniz.</p>
          <RowList<HomeCard>
            items={h.cards}
            onChange={(cards) => file.setValue((v) => ({ ...v, cards }))}
            noun="kart"
            title={(c) => c.title.tr || 'Yeni kart'}
            subtitle={(c) => c.subtitle.tr || 'Alt metin yok'}
            icon={(c) => (
              <span className={`tone-tile ${c.visible ? 'tone-deniz' : ''}`} aria-hidden="true">
                <SiteIcon name={c.icon} size={18} />
              </span>
            )}
            marks={(c) => (
              <>
                <span className="tone-chip tone-lavanta">{`→ ${targetName(c)}`}</span>
                {!c.visible && <span className="tone-chip tone-kiremit">Gizli</span>}
              </>
            )}
            newItem={() => ({ id: newId('kart'), target: { page: 'about' }, title: { tr: '', en: '' }, subtitle: { tr: '', en: '' }, icon: 'leaf', visible: true })}
            addLabel="Kart ekle"
            render={(c, update, i) => {
              const isUrl = 'url' in c.target;
              return (
                <>
                  <Toggle label="Ana sayfada görünsün" checked={c.visible} onChange={(visible) => update({ visible })} />
                  <LocalizedField label="Başlık" value={c.title} onChange={(title) => update({ title })} issues={file.issues} path={`cards.${i}.title`} />
                  <LocalizedField label="Alt metin" value={c.subtitle} onChange={(subtitle) => update({ subtitle })} issues={file.issues} path={`cards.${i}.subtitle`} />
                  <div className="form-2">
                    <IconSelect value={c.icon} options={ICON_OPTIONS} onChange={(icon) => update({ icon })} />
                    <Select
                      label="Gideceği yer"
                      value={isUrl ? '__url' : (c.target as { page: string }).page}
                      options={[...PAGE_KEYS.map((k) => ({ value: k, label: PAGE_LABEL[k] })), { value: '__url', label: 'Dış bağlantı' }]}
                      onChange={(v) => update({ target: v === '__url' ? { url: 'https://' } : { page: v as (typeof PAGE_KEYS)[number] } })}
                    />
                  </div>
                  {isUrl && (
                    <Field
                      label="Bağlantı adresi"
                      value={(c.target as { url: string }).url}
                      onChange={(url) => update({ target: { url } })}
                      error={file.issues[`cards.${i}.target.url`] ?? file.issues[`cards.${i}.target`]}
                    />
                  )}
                </>
              );
            }}
          />
          <h3>Süreç adımları</h3>
          <p className="k-hint">Bilgisayarda ana sayfada görünen en fazla üç adım: görüşmelerin nasıl ilerlediğini kısaca anlatın.</p>
          <RowList<ProcessStep>
            numbered
            items={h.process ?? []}
            onChange={(next) => file.setValue((v) => ({ ...v, process: next.length ? next : undefined }))}
            noun="adım"
            title={(st) => st.title.tr || 'Yeni adım'}
            subtitle={(st) => st.text.tr || 'Metin yok'}
            newItem={(h.process ?? []).length < 3 ? () => ({ title: { tr: '', en: '' }, text: { tr: '', en: '' } }) : undefined}
            addLabel="Adım ekle"
            render={(st, update, i) => (
              <>
                <LocalizedField label="Adım başlığı" value={st.title} onChange={(title) => update({ title })} issues={file.issues} path={`process.${i}.title`} />
                <LocalizedField label="Adım metni" value={st.text} onChange={(text) => update({ text })} multiline inline rows={4} issues={file.issues} path={`process.${i}.text`} />
              </>
            )}
          />
        </>
      )}
    </SettingsForm>
  );
}

const LINK_ICONS: Link['icon'][] = ['instagram', 'linkedin', 'medium', 'substack', 'email', 'youtube', 'x', 'tiktok', 'threads'];

// Readable names for the Simge select (the stored value stays the lower-case id).
const ICON_NAMES: Record<Link['icon'], string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  medium: 'Medium',
  substack: 'Substack',
  email: 'E-posta',
  youtube: 'YouTube',
  x: 'X',
  tiktok: 'TikTok',
  threads: 'Threads',
};

export function LinklerScreen() {
  const file = useSettingsFile<Link[]>('src/data/links.json', parseLinks, 'Sosyal Bağlantılar');
  return (
    <SettingsForm title="Sosyal Bağlantılar" screen="linkler" file={file}>
      {(links) => (
        <>
          <h3>Hesaplar</h3>
          <RowList<Link>
            items={links}
            onChange={(next) => file.setValue(() => next)}
            noun="bağlantı"
            title={(l) => l.label || 'Yeni bağlantı'}
            subtitle={(l) => l.url.replace(/^mailto:/, '').replace(/^https:\/\/(www\.)?/, '')}
            icon={(l) => (
              <span className="tone-tile tone-lacivert" aria-hidden="true">
                <SiteIcon name={l.icon} size={18} />
              </span>
            )}
            marks={(l) => (
              <>
                {l.inHero && <span className="tone-chip tone-deniz">Ana sayfa</span>}
                {l.inFooter && <span className="tone-chip tone-lavanta">Alt bilgi</span>}
                {file.issues[`${links.indexOf(l)}.url`] && <span className="tone-chip tone-kiremit">Adres hatalı</span>}
              </>
            )}
            newItem={() => ({ id: newId('link'), label: '', url: 'https://', icon: 'instagram', inHero: true, inFooter: true })}
            addLabel="Bağlantı ekle"
            render={(l, update, i) => (
              <>
                <div className="form-2">
                  <Field label="Görünen ad" value={l.label} onChange={(label) => update({ label })} />
                  <IconSelect value={l.icon} options={LINK_ICONS.map((v) => ({ value: v, label: ICON_NAMES[v] }))} onChange={(icon) => update({ icon: icon as Link['icon'] })} />
                </div>
                <Field
                  label="Adres"
                  value={l.url}
                  onChange={(url) => update({ url })}
                  hint={l.icon === 'email' ? 'E-posta için mailto:ad@alanadi.com yazın.' : 'https:// ile başlayan profil adresiniz.'}
                  error={file.issues[`${i}.url`]}
                />
                <div className="row">
                  <Toggle label="Ana sayfada" checked={l.inHero} onChange={(inHero) => update({ inHero })} />
                  <Toggle label="Alt bilgide" checked={l.inFooter} onChange={(inFooter) => update({ inFooter })} />
                </div>
                <LocalizedField
                  label="Not"
                  value={l.note ?? { tr: '', en: '' }}
                  onChange={(v) => update({ note: v.tr.trim() || v.en.trim() ? v : undefined })}
                  hint="İsteğe bağlı. Hesabın yanında görünen kısa not, örneğin “İngilizce”."
                />
              </>
            )}
          />
          <h3>Genel</h3>
          <div className="links-summary">
            <span>
              <b>{links.filter((l) => l.inHero).length}</b> hesap ana sayfada
            </span>
            <span>
              <b>{links.filter((l) => l.inFooter).length}</b> hesap sayfaların altında
            </span>
            <span className="k-hint">Sıra, sitede görünen sıradır. Bir satıra basıp penceresindeki oklarla yerini değiştirebilirsiniz.</span>
          </div>
        </>
      )}
    </SettingsForm>
  );
}

const TYPE_LABEL: Record<Resource['type'], string> = {
  book: 'Kitap',
  article: 'Makale',
  scale: 'Ölçek',
  video: 'Video',
  podcast: 'Podcast',
  guide: 'Rehber',
};

/** Each kind of resource: its site icon and tone in the library. */
const TYPE_LOOK: Record<Resource['type'], { icon: string; tone: string }> = {
  book: { icon: 'book', tone: 'lavanta' },
  article: { icon: 'article', tone: 'deniz' },
  scale: { icon: 'scale', tone: 'adacayi' },
  video: { icon: 'video', tone: 'kiremit' },
  podcast: { icon: 'podcast', tone: 'gunes' },
  guide: { icon: 'guide', tone: 'adacayi' },
};

/**
 * Kaynaklar (owner's review 2026-10-21): a library rather than a form. The page's opening note on top;
 * then a card per resource (kind, title, author, the first line of the note, "Öne çıkan"), filtered
 * by kind and searchable; a card opens the resource in its own window, in sections.
 */
export function KaynaklarScreen() {
  const file = useSettingsFile<Resources>('src/data/resources.json', parseResources, 'Kaynaklar');
  const [kind, setKind] = useState<Resource['type'] | 'all'>('all');
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('tr-TR');
  return (
    <SettingsForm title="Kaynaklar" screen="kaynaklar" file={file} intro="Önerdiğiniz kitaplar, yazılar, ölçekler, videolar ve rehberler. Her kaynak sitede bir kart olarak görünür; öne çıkan kaynak sayfanın başında durur.">
      {(r) => (
        <>
          <h3>Sayfa girişi</h3>
          <LocalizedField label="Benim notum" value={r.myNote} onChange={(myNote) => file.setValue((v) => ({ ...v, myNote }))} multiline issues={file.issues} path="myNote" />
          <h3>Kütüphane</h3>
          <div className="lib-tools">
            <div className="segmented" role="group" aria-label="Tür">
              <button type="button" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
                {`Tümü (${r.items.length})`}
              </button>
              {(Object.keys(TYPE_LABEL) as Resource['type'][])
                .filter((t) => r.items.some((x) => x.type === t))
                .map((t) => (
                  <button key={t} type="button" aria-pressed={kind === t} onClick={() => setKind(t)}>
                    {`${TYPE_LABEL[t]} (${r.items.filter((x) => x.type === t).length})`}
                  </button>
                ))}
            </div>
            <Field label="Kaynaklarda ara" value={query} onChange={setQuery} placeholder="Başlık ya da yazar" />
          </div>
          <RowList<Resource>
            cards
            items={r.items}
            onChange={(items) => file.setValue((v) => ({ ...v, items }))}
            visible={(it) => (kind === 'all' || it.type === kind) && (!q || `${it.title} ${it.author ?? ''}`.toLocaleLowerCase('tr-TR').includes(q))}
            noun="kaynak"
            title={(it) => it.title || 'Yeni kaynak'}
            subtitle={(it) => (
              <>
                {it.author && <span className="lib-author">{it.author}</span>}
                <span className="lib-note">{it.note.tr || 'Kısa not henüz yazılmadı.'}</span>
              </>
            )}
            icon={(it) => (
              <span className={`tone-tile tone-tile-lg tone-${TYPE_LOOK[it.type].tone}`} aria-hidden="true">
                <SiteIcon name={TYPE_LOOK[it.type].icon} size={22} />
              </span>
            )}
            marks={(it) => (
              <>
                <span className={`tone-chip tone-${TYPE_LOOK[it.type].tone}`}>{TYPE_LABEL[it.type]}</span>
                {it.featured && <span className="tone-chip tone-gunes">★ Öne çıkan</span>}
                {it.cover && <span className="tone-chip tone-lacivert">Kapaklı</span>}
              </>
            )}
            newItem={() => ({ id: newId('kaynak'), type: kind === 'all' ? 'book' : kind, title: '', note: { tr: '', en: '' }, url: 'https://', featured: false })}
            addLabel="Kaynak ekle"
            render={(it, update, i) => (
              <>
                <h4 className="row-form-title">Temel bilgiler</h4>
                <div className="form-2">
                  <Select
                    label="Tür"
                    value={it.type}
                    options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value: value as Resource['type'], label }))}
                    onChange={(type) => update({ type })}
                  />
                  <Field label="Yazar (isteğe bağlı)" value={it.author ?? ''} onChange={(a) => update({ author: a.trim() ? a : undefined })} />
                </div>
                <Field label="Başlık" value={it.title} onChange={(title) => update({ title })} error={file.issues[`items.${i}.title`]} />
                <Field label="Bağlantı" value={it.url} onChange={(url) => update({ url })} error={file.issues[`items.${i}.url`]} hint="Kaynağın kendi sayfası: kitabın yayınevi, makalenin adresi, videonun bağlantısı." />
                <h4 className="row-form-title">Açıklama</h4>
                <LocalizedField label="Kısa not" value={it.note} onChange={(note) => update({ note })} multiline inline rows={4} issues={file.issues} path={`items.${i}.note`} hint="Kaynağı neden önerdiğinizi bir iki cümleyle yazın." />
                <h4 className="row-form-title">Görünüm</h4>
                <ImageField label="Kapak (isteğe bağlı)" value={it.cover ?? null} onChange={(cover) => update({ cover: cover ?? undefined })} preset="resource" baseName={it.id} dir="kaynaklar/" staging={file.staging} allowRemove />
                <Toggle
                  label="Öne çıkan kaynak (sayfanın başında büyük kart)"
                  checked={it.featured}
                  onChange={(on) => file.setValue((v) => ({ ...v, items: v.items.map((x, j) => ({ ...x, featured: on ? j === i : j === i ? false : x.featured })) }))}
                />
              </>
            )}
          />
        </>
      )}
    </SettingsForm>
  );
}
