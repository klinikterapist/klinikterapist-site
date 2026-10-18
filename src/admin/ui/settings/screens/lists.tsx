/** Ana sayfa (cards), Sosyal ve linkler, Kaynaklar: list editors over one JSON file each. */
import {
  PAGE_KEYS, parseHome, parseLinks, parseResources, type Home, type HomeCard, type Link, type Resources, type Resource,
} from '../../../../lib/schemas';
import { ICONS, type IconName } from '../../../../lib/icons';
import { Field, Select, Toggle } from '../../kit';
import { ImageField, ListEditor, LocalizedField, SettingsForm } from '../fields';
import { useSettingsFile } from '../useSettingsFile';

type ProcessStep = NonNullable<Home['process']>[number];

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

const PAGE_LABEL: Record<(typeof PAGE_KEYS)[number], string> = {
  home: 'Ana sayfa',
  about: 'Hakkımda',
  blog: 'Blog',
  resources: 'Kaynaklar',
  contact: 'İletişim',
  appointment: 'Randevu',
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
export function IconSelect({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
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

export function AnaSayfaScreen() {
  const file = useSettingsFile<Home>('src/data/home.json', parseHome, 'Ana sayfa');
  return (
    <SettingsForm title="Ana sayfa" screen="ana-sayfa" file={file}>
      {(h) => (
        <>
        <ListEditor<HomeCard>
          items={h.cards}
          onChange={(cards) => file.setValue((v) => ({ ...v, cards }))}
          itemLabel={(c) => c.title.tr || 'Yeni kart'}
          newItem={() => ({ id: newId('kart'), target: { page: 'about' }, title: { tr: '', en: '' }, subtitle: { tr: '', en: '' }, icon: 'leaf', visible: true })}
          addLabel="Kart ekle"
          render={(c, update, i) => {
            const isUrl = 'url' in c.target;
            return (
              <>
                <Toggle label="Ana sayfada görünsün" checked={c.visible} onChange={(visible) => update({ visible })} />
                <LocalizedField label="Başlık" value={c.title} onChange={(title) => update({ title })} issues={file.issues} path={`cards.${i}.title`} />
                <LocalizedField label="Alt metin" value={c.subtitle} onChange={(subtitle) => update({ subtitle })} issues={file.issues} path={`cards.${i}.subtitle`} />
                <IconSelect value={c.icon} options={ICON_OPTIONS} onChange={(icon) => update({ icon })} />
                <Select
                  label="Gideceği yer"
                  value={isUrl ? '__url' : (c.target as { page: string }).page}
                  options={[...PAGE_KEYS.map((k) => ({ value: k, label: PAGE_LABEL[k] })), { value: '__url', label: 'Dış bağlantı' }]}
                  onChange={(v) => update({ target: v === '__url' ? { url: 'https://' } : { page: v as (typeof PAGE_KEYS)[number] } })}
                />
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
        <ListEditor<ProcessStep>
          items={h.process ?? []}
          onChange={(next) => file.setValue((v) => ({ ...v, process: next.length ? next : undefined }))}
          itemLabel={(s) => s.title.tr || 'Yeni adım'}
          newItem={(h.process ?? []).length < 3 ? () => ({ title: { tr: '', en: '' }, text: { tr: '', en: '' } }) : undefined}
          addLabel="Adım ekle"
          render={(s, update, i) => (
            <>
              <LocalizedField label="Adım başlığı" value={s.title} onChange={(title) => update({ title })} issues={file.issues} path={`process.${i}.title`} />
              <LocalizedField label="Adım metni" value={s.text} onChange={(text) => update({ text })} multiline issues={file.issues} path={`process.${i}.text`} />
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
  instagram: 'Instagram', linkedin: 'LinkedIn', medium: 'Medium', substack: 'Substack',
  email: 'E-posta', youtube: 'YouTube', x: 'X', tiktok: 'TikTok', threads: 'Threads',
};

export function LinklerScreen() {
  const file = useSettingsFile<Link[]>('src/data/links.json', parseLinks, 'Sosyal ve linkler');
  return (
    <SettingsForm title="Sosyal ve linkler" screen="linkler" file={file}>
      {(links) => (
        <ListEditor<Link>
          items={links}
          onChange={(next) => file.setValue(() => next)}
          itemLabel={(l) => l.label || 'Yeni bağlantı'}
          newItem={() => ({ id: newId('link'), label: '', url: 'https://', icon: 'instagram', inHero: true, inFooter: true })}
          addLabel="Bağlantı ekle"
          render={(l, update, i) => (
            <>
              <Field label="Görünen ad" value={l.label} onChange={(label) => update({ label })} />
              <IconSelect
                value={l.icon}
                options={LINK_ICONS.map((v) => ({ value: v, label: ICON_NAMES[v] }))}
                onChange={(icon) => update({ icon: icon as Link['icon'] })}
              />
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

export function KaynaklarScreen() {
  const file = useSettingsFile<Resources>('src/data/resources.json', parseResources, 'Kaynaklar');
  return (
    <SettingsForm title="Kaynaklar" screen="kaynaklar" file={file}>
      {(r) => (
        <>
          <LocalizedField
            label="Benim notum"
            value={r.myNote}
            onChange={(myNote) => file.setValue((v) => ({ ...v, myNote }))}
            multiline
            issues={file.issues}
            path="myNote"
          />
          <ListEditor<Resource>
            items={r.items}
            onChange={(items) => file.setValue((v) => ({ ...v, items }))}
            itemLabel={(it) => it.title || 'Yeni kaynak'}
            newItem={() => ({ id: newId('kaynak'), type: 'book', title: '', note: { tr: '', en: '' }, url: 'https://', featured: false })}
            addLabel="Kaynak ekle"
            render={(it, update, i) => (
              <>
                <label className="k-toggle">
                  <input
                    type="radio"
                    name="featured"
                    checked={it.featured}
                    aria-label={`Öne çıkan: ${it.title}`}
                    onChange={() => file.setValue((v) => ({ ...v, items: v.items.map((x, j) => ({ ...x, featured: j === i })) }))}
                  />
                  <span>Öne çıkan kaynak</span>
                </label>
                <Select label="Tür" value={it.type} options={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value: value as Resource['type'], label }))} onChange={(type) => update({ type })} />
                <Field label="Başlık" value={it.title} onChange={(title) => update({ title })} error={file.issues[`items.${i}.title`]} />
                <Field label="Yazar (isteğe bağlı)" value={it.author ?? ''} onChange={(a) => update({ author: a.trim() ? a : undefined })} />
                <LocalizedField label="Kısa not" value={it.note} onChange={(note) => update({ note })} multiline issues={file.issues} path={`items.${i}.note`} />
                <Field label="Bağlantı" value={it.url} onChange={(url) => update({ url })} error={file.issues[`items.${i}.url`]} />
                <ImageField
                  label="Kapak (isteğe bağlı)"
                  value={it.cover ?? null}
                  onChange={(cover) => update({ cover: cover ?? undefined })}
                  preset="resource"
                  baseName={it.id}
                  dir="kaynaklar/"
                  staging={file.staging}
                  allowRemove
                />
              </>
            )}
          />
        </>
      )}
    </SettingsForm>
  );
}
