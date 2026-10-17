/** Ana sayfa (cards), Sosyal ve linkler, Kaynaklar: list editors over one JSON file each. */
import {
  PAGE_KEYS, parseHome, parseLinks, parseResources, type Home, type HomeCard, type Link, type Resources, type Resource,
} from '../../../../lib/schemas';
import { ICONS } from '../../../../lib/icons';
import { Field, Select, Toggle } from '../../kit';
import { ImageField, ListEditor, LocalizedField, SettingsForm } from '../fields';
import { useSettingsFile } from '../useSettingsFile';

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
};
const ICON_OPTIONS = Object.keys(ICONS).map((k) => ({ value: k, label: k }));

export function AnaSayfaScreen() {
  const file = useSettingsFile<Home>('src/data/home.json', parseHome, 'Ana sayfa');
  return (
    <SettingsForm title="Ana sayfa" intro="Randevu butonunun altındaki kartlar: sıra, görünürlük ve metinler." file={file}>
      {(h) => (
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
                <Select label="Simge" value={c.icon} options={ICON_OPTIONS} onChange={(icon) => update({ icon })} />
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
      )}
    </SettingsForm>
  );
}

const LINK_ICONS: Link['icon'][] = ['instagram', 'linkedin', 'medium', 'substack', 'email', 'youtube', 'x'];

export function LinklerScreen() {
  const file = useSettingsFile<Link[]>('src/data/links.json', parseLinks, 'Sosyal ve linkler');
  return (
    <SettingsForm title="Sosyal ve linkler" intro="Ana sayfadaki ve alt bilgideki sosyal medya simgeleri." file={file}>
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
              <Select label="Simge" value={l.icon} options={LINK_ICONS.map((v) => ({ value: v, label: v }))} onChange={(icon) => update({ icon })} />
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
    <SettingsForm title="Kaynaklar" file={file}>
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
