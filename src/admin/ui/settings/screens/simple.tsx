/** Profil, İletişim and SEO genel: flat forms over one JSON file each. */
import { parseContact, parseProfile, parseSeo, type Contact, type Profile, type Seo } from '../../../../lib/schemas';
import { Field } from '../../kit';
import { ImageField, LocalizedField, SettingsForm } from '../fields';
import { useSettingsFile } from '../useSettingsFile';

export function ProfilScreen() {
  const file = useSettingsFile<Profile>('src/data/profile.json', parseProfile, 'Profil');
  const set = <K extends keyof Profile>(k: K) => (v: Profile[K]) => file.setValue((p) => ({ ...p, [k]: v }));
  return (
    <SettingsForm title="Profil" screen="profil" file={file}>
      {(p) => (
        <>
          <Field label="Ad soyad" value={p.name} onChange={set('name')} error={file.issues.name} />
          <LocalizedField label="Unvan" value={p.title} onChange={set('title')} issues={file.issues} path="title" />
          <LocalizedField label="Slogan" value={p.tagline} onChange={set('tagline')} issues={file.issues} path="tagline" />
          <LocalizedField label="Kısa tanıtım" value={p.intro} onChange={set('intro')} multiline issues={file.issues} path="intro" />
          <LocalizedField
            label="Yazar kutusu cümlesi"
            value={p.shortIntro ?? { tr: '', en: '' }}
            onChange={(v) => set('shortIntro')(v.tr.trim() || v.en.trim() ? v : undefined)}
            hint="Yazıların altındaki yazar kutusunda görünen tek cümle. Boş bırakırsanız kısa tanıtımın tamamı kullanılır."
          />
          <ImageField
            label="Portre fotoğrafı"
            value={p.photo}
            onChange={set('photo')}
            preset="profile"
            baseName="profil"
            staging={file.staging}
            allowRemove
            hint="Fotoğraf çerçeveye uygun kırpılır (800 × 880) ve küçültülür."
          />
          <LocalizedField label="Fotoğrafın alt metni" value={p.photoAlt} onChange={set('photoAlt')} issues={file.issues} path="photoAlt" />
        </>
      )}
    </SettingsForm>
  );
}

export function IletisimScreen() {
  const file = useSettingsFile<Contact>('src/data/contact.json', parseContact, 'İletişim');
  const set = <K extends keyof Contact>(k: K) => (v: Contact[K]) => file.setValue((c) => ({ ...c, [k]: v }));
  return (
    <SettingsForm title="İletişim" screen="iletisim" file={file}>
      {(c) => (
        <>
          <LocalizedField label="Giriş metni" value={c.intro} onChange={set('intro')} multiline issues={file.issues} path="intro" />
          <LocalizedField label="Çalışma biçimi" value={c.workStyle} onChange={set('workStyle')} multiline issues={file.issues} path="workStyle" />
          <LocalizedField label="Dönüş süresi" value={c.responseTime} onChange={set('responseTime')} issues={file.issues} path="responseTime" />
          <LocalizedField label="Acil durum uyarısı" value={c.emergencyNote} onChange={set('emergencyNote')} multiline issues={file.issues} path="emergencyNote" />
          <Field label="E-posta adresi" type="email" value={c.email} onChange={set('email')} error={file.issues.email} />
        </>
      )}
    </SettingsForm>
  );
}

export function SeoScreen() {
  const file = useSettingsFile<Seo>('src/data/seo.json', parseSeo, 'SEO genel');
  const set = <K extends keyof Seo>(k: K) => (v: Seo[K]) => file.setValue((s) => ({ ...s, [k]: v }));
  return (
    <SettingsForm title="SEO genel" screen="seo" file={file}>
      {(s) => (
        <>
          <LocalizedField label="Site adı" value={s.siteName} onChange={set('siteName')} issues={file.issues} path="siteName" />
          <LocalizedField
            label="Varsayılan açıklama"
            value={s.defaultDescription}
            onChange={set('defaultDescription')}
            multiline
            issues={file.issues}
            path="defaultDescription"
          />
          <ImageField
            label="Varsayılan paylaşım görseli"
            value={s.ogImage}
            onChange={(v) => v && set('ogImage')(v)}
            preset="og"
            baseName="paylasim"
            staging={file.staging}
            hint="Kapak görseli olmayan sayfalar paylaşıldığında görünür (1200 × 630)."
          />
          <Field
            label="Google Search Console doğrulama kodu"
            value={s.gscVerification ?? ''}
            onChange={(v) => set('gscVerification')(v.trim() || undefined)}
            hint='Search Console › "HTML etiketi" yöntemindeki content="…" değeri.'
          />
        </>
      )}
    </SettingsForm>
  );
}
