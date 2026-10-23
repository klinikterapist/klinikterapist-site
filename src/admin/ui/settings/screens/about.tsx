/**
 * Hakkımda: texts, working areas, the Markdown sections, the timeline and the certificates. Owner's
 * review 2026-10-21: the long texts open in their own window; the lists are rows that open a window.
 * Owner's review 2026-10-23 (item 9): everything the page shows can be added and removed here: the work
 * areas (with an optional short line for their card), the topics and approaches, the career, and the
 * education groups one by one (degrees, certificates, supervision, practice, workshops and webinars),
 * each card with its details and, optionally, its list of courses.
 */
import { parseAbout, type About, type Period } from '../../../../lib/schemas';
import { ICONS } from '../../../../lib/icons';
import { Button, Field, Select } from '../../kit';
import { ListEditor, LocalizedField, SettingsForm } from '../fields';
import { MarkdownBlock, RowList, SiteIcon } from '../rows';
import { useSettingsFile } from '../useSettingsFile';
import { IconSelect } from './lists';

type Area = About['areas'][number];
type Step = About['timeline'][number];
type Cert = About['certificates'][number];
type Job = About['career'][number];
type Education = NonNullable<About['education']>;
type Group = Education['groups'][number];
type Card = Group['items'][number];
type Line = Card['lines'][number];
type Text = { tr: string; en: string };

const ICON_OPTIONS = Object.keys(ICONS).map((k) => ({ value: k, label: k }));
const EMPTY: Text = { tr: '', en: '' };

const JOB_KINDS: { value: Job['kind']; label: string }[] = [
  { value: 'school', label: 'Okul' },
  { value: 'work', label: 'İş' },
  { value: 'volunteer', label: 'Gönüllü' },
];

/** The education groups by kind, with the default title of a new group and its tone in the panel. */
const GROUP_KINDS: { value: Group['kind']; label: string; title: Text; tone: string; icon: string }[] = [
  { value: 'degree', label: 'Eğitim (lisans, yüksek lisans)', title: { tr: 'Lisans', en: "Bachelor's degree" }, tone: 'lavanta', icon: 'grad' },
  { value: 'certificate', label: 'Sertifika', title: { tr: 'Sertifika', en: 'Certificates' }, tone: 'gunes', icon: 'award' },
  { value: 'supervision', label: 'Süpervizyon', title: { tr: 'Süpervizyon', en: 'Supervision' }, tone: 'adacayi', icon: 'users' },
  { value: 'practice', label: 'Uygulama', title: { tr: 'Uygulama', en: 'Practice' }, tone: 'deniz', icon: 'laptop' },
  { value: 'workshop', label: 'Workshop ve webinar', title: { tr: 'Workshop ve webinar', en: 'Workshops and webinars' }, tone: 'kiremit', icon: 'calendar' },
  { value: 'congress', label: 'Kongre', title: { tr: 'Kongre', en: 'Congresses' }, tone: 'lacivert', icon: 'globe' },
];
const kindOf = (k: Group['kind']) => GROUP_KINDS.find((g) => g.value === k) ?? GROUP_KINDS[0];

const hours = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const newCard = (): Card => ({ title: { ...EMPTY }, meta: { ...EMPTY }, text: { ...EMPTY }, badge: { ...EMPTY }, theory: 0, practice: 0, note: { ...EMPTY }, lines: [] });

function PeriodField({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const localized = typeof value !== 'string';
  return (
    <>
      <Select
        label="Dönem biçimi"
        value={localized ? 'localized' : 'single'}
        options={[
          { value: 'single', label: 'Tek metin (ör. 2016–2020)' },
          { value: 'localized', label: 'TR/EN ayrı (ör. Devam ediyor / Ongoing)' },
        ]}
        onChange={(mode) => {
          if (mode === 'localized' && !localized) onChange({ tr: value, en: value });
          if (mode === 'single' && localized) onChange(value.tr);
        }}
      />
      {localized ? <LocalizedField label="Dönem" value={value} onChange={onChange} /> : <Field label="Dönem" value={value} onChange={onChange} />}
    </>
  );
}

/** One education card: title, the line under it, its text and badge, hours, a note and its courses. */
function CardFields({ x, update }: { x: Card; update: (patch: Partial<Card>) => void }) {
  return (
    <>
      <LocalizedField label="Başlık" value={x.title} onChange={(title) => update({ title })} />
      <LocalizedField label="Kurum, tarih ve kısa bilgi" value={x.meta} onChange={(meta) => update({ meta })} hint="Başlığın altındaki küçük satır (ör. Türk Psikologlar Derneği · Temmuz 2025)." />
      <LocalizedField label="Açıklama (isteğe bağlı)" value={x.text} onChange={(text) => update({ text })} multiline inline />
      <LocalizedField label="Sağ üstteki etiket (isteğe bağlı)" value={x.badge} onChange={(badge) => update({ badge })} hint='Örneğin "48 sa." ya da "10 seans". Boşsa görünmez.' />
      <div className="add-grid">
        <Field label="Teorik eğitim (saat)" type="number" value={String(x.theory)} onChange={(v) => update({ theory: hours(v) })} />
        <Field label="Uygulamalı eğitim (saat)" type="number" value={String(x.practice)} onChange={(v) => update({ practice: hours(v) })} />
      </div>
      <p className="k-hint">Bütün kartların saatleri sayfadaki toplam sayaçlarda toplanır.</p>
      <LocalizedField label="Not (isteğe bağlı)" value={x.note} onChange={(note) => update({ note })} />
      <h4>Ders ya da konu listesi (isteğe bağlı)</h4>
      <p className="k-hint">Doluysa kart, sık sorulan sorular gibi açılıp bu listeyi gösterir. Ara başlık satırı derslerin üstünde küçük bir başlık olur.</p>
      <ListEditor<Line>
        items={x.lines}
        onChange={(lines) => update({ lines })}
        itemLabel={(l) => l.heading?.tr || l.title?.tr || 'Yeni satır'}
        newItem={() => ({ title: { ...EMPTY } })}
        addLabel="Satır ekle"
        render={(l, u) => (
          <>
            <Select
              label="Satır türü"
              value={l.heading ? 'heading' : 'line'}
              options={[
                { value: 'line', label: 'Ders / konu' },
                { value: 'heading', label: 'Ara başlık' },
              ]}
              onChange={(v) => u(v === 'heading' ? { heading: l.title ?? { ...EMPTY }, title: undefined, theory: undefined, practice: undefined } : { title: l.heading ?? { ...EMPTY }, heading: undefined })}
            />
            {l.heading ? (
              <LocalizedField label="Ara başlık" value={l.heading} onChange={(heading) => u({ heading })} />
            ) : (
              <>
                <LocalizedField label="Ders / konu" value={l.title ?? EMPTY} onChange={(title) => u({ title })} />
                <div className="add-grid">
                  <Field label="Teorik (saat)" type="number" value={l.theory === undefined ? '' : String(l.theory)} onChange={(v) => u({ theory: v.trim() ? hours(v) : undefined })} />
                  <Field label="Uygulamalı (saat)" type="number" value={l.practice === undefined ? '' : String(l.practice)} onChange={(v) => u({ practice: v.trim() ? hours(v) : undefined })} />
                </div>
              </>
            )}
          </>
        )}
      />
    </>
  );
}

export function HakkimdaScreen() {
  const file = useSettingsFile<About>('src/data/about.json', parseAbout, 'Hakkımda');
  const set = <K extends keyof About>(k: K) => (v: About[K]) => file.setValue((a) => ({ ...a, [k]: v }));
  return (
    <SettingsForm title="Hakkımda" screen="hakkimda" file={file}>
      {(a) => {
        const education: Education = a.education ?? { intro: { ...EMPTY }, groups: [] };
        const setGroups = (groups: Group[]) => set('education')({ ...education, groups });
        const setGroup = (i: number, patch: Partial<Group>) => setGroups(education.groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));
        return (
          <>
            <LocalizedField label="Sayfa başlığı" value={a.heading} onChange={set('heading')} issues={file.issues} path="heading" />
            <LocalizedField label="Giriş cümlesi" value={a.lead} onChange={set('lead')} multiline issues={file.issues} path="lead" />

            <h3>Çalışma Alanları</h3>
            <p className="k-hint">Nasıl Çalışırım sekmesinde renkli kartlar olarak görünür. Kısa açıklama isteğe bağlıdır; boşsa kartta yalnızca ad görünür.</p>
            <RowList<Area>
              items={a.areas}
              onChange={set('areas')}
              noun="alan"
              title={(x) => x.label.tr || 'Yeni alan'}
              subtitle={(x) => x.desc?.tr || x.label.en}
              icon={(x) => (
                <span className="tone-tile tone-adacayi" aria-hidden="true">
                  <SiteIcon name={x.icon} size={18} />
                </span>
              )}
              newItem={() => ({ icon: 'leaf', label: { ...EMPTY } })}
              addLabel="Alan ekle"
              render={(x, update) => (
                <>
                  <IconSelect value={x.icon} options={ICON_OPTIONS} onChange={(icon) => update({ icon })} />
                  <LocalizedField label="Alan" value={x.label} onChange={(label) => update({ label })} />
                  <LocalizedField
                    label="Kısa açıklama (isteğe bağlı)"
                    value={x.desc ?? EMPTY}
                    onChange={(desc) => update({ desc: desc.tr.trim() || desc.en.trim() ? desc : undefined })}
                    hint="Örneğin: Birebir, düzenli görüşmeler."
                  />
                </>
              )}
            />

            <h3>Yaklaşımlar</h3>
            <p className="k-hint">Kısaltması parantez içinde yazılırsa kartta büyük görünür: "Bilişsel Davranışçı Terapi (BDT)". Parantez içindeki uzun bir sözcük ise kartın alt satırı olur.</p>
            <RowList<Text>
              items={a.approaches}
              onChange={set('approaches')}
              noun="yaklaşım"
              title={(x) => x.tr || 'Yeni yaklaşım'}
              subtitle={(x) => x.en}
              icon={() => (
                <span className="tone-tile tone-lavanta" aria-hidden="true">
                  <SiteIcon name="leaf" size={18} />
                </span>
              )}
              newItem={() => ({ ...EMPTY })}
              addLabel="Yaklaşım ekle"
              render={(x, update) => <LocalizedField label="Yaklaşım" value={x} onChange={(v) => update(v)} />}
            />

            <h3>Konular</h3>
            <p className="k-hint">Çalıştığınız konular; sayfada renkli etiketler olarak görünür.</p>
            <RowList<Text>
              items={a.topics}
              onChange={set('topics')}
              noun="konu"
              title={(x) => x.tr || 'Yeni konu'}
              subtitle={(x) => x.en}
              icon={() => (
                <span className="tone-tile tone-deniz" aria-hidden="true">
                  <SiteIcon name="tag" size={18} />
                </span>
              )}
              newItem={() => ({ ...EMPTY })}
              addLabel="Konu ekle"
              render={(x, update) => <LocalizedField label="Konu" value={x} onChange={(v) => update(v)} />}
            />

            <h3>Ben Kimim?</h3>
            <MarkdownBlock label="Ben kimim" value={a.whoAmI} onChange={set('whoAmI')} />
            <h3>Neden Bu İşi Yapıyorum?</h3>
            <MarkdownBlock label="Neden bu iş" value={a.whyThisWork} onChange={set('whyThisWork')} />
            <LocalizedField label="Alıntı" value={a.quote} onChange={set('quote')} multiline issues={file.issues} path="quote" />
            <h3>klinikterapist Nedir?</h3>
            <MarkdownBlock label="Marka hikayesi" value={a.brand} onChange={set('brand')} />

            <h3>Kariyer</h3>
            <p className="k-hint">Eğitim ve Kariyer sekmesindeki zaman çizelgesi: okullar ve işler, en yenisi üstte.</p>
            <RowList<Job>
              items={a.career}
              onChange={set('career')}
              noun="satır"
              title={(x) => x.title.tr || 'Yeni satır'}
              subtitle={(x) => x.detail.tr}
              marks={(x) => (
                <span className="tone-chip tone-lavanta">{`${JOB_KINDS.find((k) => k.value === x.kind)?.label ?? ''} · ${typeof x.period === 'string' ? x.period || 'Dönem yok' : x.period.tr}`}</span>
              )}
              newItem={() => ({ period: '', title: { ...EMPTY }, detail: { ...EMPTY }, kind: 'work' })}
              addLabel="Kariyer satırı ekle"
              render={(x, update) => (
                <>
                  <Select label="Tür" value={x.kind} options={JOB_KINDS} onChange={(kind) => update({ kind })} />
                  <LocalizedField label="Unvan ve kurum" value={x.title} onChange={(title) => update({ title })} />
                  <LocalizedField label="Ayrıntı" value={x.detail} onChange={(detail) => update({ detail })} multiline inline />
                  <PeriodField value={x.period} onChange={(period) => update({ period })} />
                </>
              )}
            />

            <h3>Eğitimler ve Sertifikalar</h3>
            <LocalizedField label="Bölümün giriş yazısı" value={education.intro} onChange={(intro) => set('education')({ ...education, intro })} multiline />
            <p className="k-hint">Her grup sayfada ayrı bir başlık altında görünür. Kartları her grubun içinden ekleyip çıkarabilirsiniz.</p>
            {education.groups.map((g, i) => {
              const k = kindOf(g.kind);
              return (
                <div key={i} className="edu-group">
                  <div className="edu-group-head">
                    <span className={`tone-tile tone-${k.tone}`} aria-hidden="true">
                      <SiteIcon name={k.icon} size={18} />
                    </span>
                    <b>{g.title.tr || k.label}</b>
                    <span className="k-hint">{`${k.label} · ${g.items.length} kart`}</span>
                    <span className="row">
                      <Button variant="ghost" disabled={i === 0} aria-label={`${g.title.tr}: yukarı`} onClick={() => setGroups(education.groups.map((x, j) => (j === i - 1 ? g : j === i ? education.groups[i - 1] : x)))}>
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={i === education.groups.length - 1}
                        aria-label={`${g.title.tr}: aşağı`}
                        onClick={() => setGroups(education.groups.map((x, j) => (j === i + 1 ? g : j === i ? education.groups[i + 1] : x)))}
                      >
                        ↓
                      </Button>
                      <Button variant="ghost" disabled={g.items.length > 0} aria-label={`${g.title.tr}: grubu sil`} onClick={() => setGroups(education.groups.filter((_, j) => j !== i))}>
                        Grubu sil
                      </Button>
                    </span>
                  </div>
                  <div className="add-grid">
                    <Select label="Grup türü" value={g.kind} options={GROUP_KINDS.map(({ value, label }) => ({ value, label }))} onChange={(kind) => setGroup(i, { kind })} />
                    <LocalizedField label="Grup başlığı" value={g.title} onChange={(title) => setGroup(i, { title })} />
                  </div>
                  <RowList<Card>
                    items={g.items}
                    onChange={(items) => setGroup(i, { items })}
                    noun="kart"
                    title={(x) => x.title.tr || 'Yeni kart'}
                    subtitle={(x) => x.meta.tr}
                    marks={(x) => (x.badge.tr ? <span className={`tone-chip tone-${k.tone}`}>{x.badge.tr}</span> : null)}
                    newItem={newCard}
                    addLabel="Kart ekle"
                    render={(x, update) => <CardFields x={x} update={update} />}
                  />
                </div>
              );
            })}
            {education.groups.some((g) => g.items.length > 0) && <p className="k-hint">İçinde kart olan grup silinemez; önce kartlarını silin.</p>}
            <div className="row">
              {GROUP_KINDS.map((k) => (
                <Button key={k.value} onClick={() => setGroups([...education.groups, { kind: k.value, title: { ...k.title }, items: [] }])}>
                  {`+ ${k.label}`}
                </Button>
              ))}
            </div>

            {a.career.length === 0 && (
              <>
                <h3>Eğitim ve Mesleki Gelişim (Eski Liste)</h3>
                <p className="k-hint">Kariyer listesi boşken sayfada bu liste görünür.</p>
                <RowList<Step>
                  items={a.timeline}
                  onChange={set('timeline')}
                  noun="adım"
                  title={(x) => x.title.tr || 'Yeni adım'}
                  subtitle={(x) => x.detail.tr}
                  marks={(x) => <span className="tone-chip tone-lavanta">{typeof x.period === 'string' ? x.period || 'Dönem yok' : x.period.tr}</span>}
                  newItem={() => ({ title: { ...EMPTY }, detail: { ...EMPTY }, period: '' })}
                  addLabel="Adım ekle"
                  render={(x, update) => (
                    <>
                      <LocalizedField label="Başlık" value={x.title} onChange={(title) => update({ title })} />
                      <LocalizedField label="Ayrıntı" value={x.detail} onChange={(detail) => update({ detail })} />
                      <PeriodField value={x.period} onChange={(period) => update({ period })} />
                    </>
                  )}
                />
              </>
            )}
            {education.groups.length === 0 && (
              <>
                <h3>Sertifikalarım (Eski Liste)</h3>
                <p className="k-hint">Eğitim grupları boşken sayfada bu liste görünür.</p>
                <RowList<Cert>
                  items={a.certificates}
                  onChange={set('certificates')}
                  noun="sertifika"
                  title={(x) => x.title.tr || 'Yeni sertifika'}
                  subtitle={(x) => [x.issuer, x.year].filter(Boolean).join(' · ')}
                  icon={() => (
                    <span className="tone-tile tone-gunes" aria-hidden="true">
                      <SiteIcon name="award" size={18} />
                    </span>
                  )}
                  newItem={() => ({ title: { ...EMPTY }, issuer: '', year: '', url: '' })}
                  addLabel="Sertifika ekle"
                  render={(x, update) => (
                    <>
                      <LocalizedField label="Sertifika / eğitim adı" value={x.title} onChange={(title) => update({ title })} />
                      <Field label="Veren kurum" value={x.issuer} onChange={(issuer) => update({ issuer })} />
                      <Field label="Yıl" value={x.year} onChange={(year) => update({ year })} />
                      <Field label="Belge bağlantısı (isteğe bağlı, https://…)" value={x.url ?? ''} onChange={(url) => update({ url })} />
                    </>
                  )}
                />
              </>
            )}
          </>
        );
      }}
    </SettingsForm>
  );
}
