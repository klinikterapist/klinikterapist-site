/**
 * E-posta Ayarları (owner's request 2026-10-21): everything about the e-mails in one place.
 * - Adresler: where notices arrive and which addresses e-mails go from, today's quota, a test send
 *   (moved here from Randevu Özeti).
 * - İmza: the lines under every e-mail.
 * - Hazır mesajlar: each ready e-mail, by where it is used; a row opens it in a window with Türkçe and
 *   English, the placeholders as buttons and a live preview with an example person. "Varsayılana dön"
 *   brings back the built-in text.
 * - Teşekkür cümleleri: the sentences the payment thank-you picks from.
 * - Otomatik e-postalar: the ones the backend sends by itself, to read.
 * Saved to src/data/mail.json with Kaydet; the panel uses it from then on.
 */
import { useEffect, useRef, useState } from 'react';
import { parseMailTexts } from '../../../../lib/schemas';
import { DEFAULT_SIGNATURE, PLACEHOLDERS, fill, setMailTexts, type Mail, type MailTexts } from '../../../../lib/mail-texts';
import { MOTIVATION as MOTIVATION_DEFAULTS } from '../../../../lib/payment';
import { MAIL_CATALOG, defaultTemplate, type CatalogEntry, type MailGroup } from '../../../lib/mail-catalog';
import { Button, Dialog } from '../../kit';
import { ChevronRight, Eye, Icon, Inbox, Mail as MailIcon, RotateCcw, Sparkles, UsersRound, Wallet, ClipboardList, Clock3, type LucideIcon } from '../../icons';
import { MailboxesCard } from '../../appointments/MailboxesCard';
import { LocalizedField, SettingsForm } from '../fields';
import { useSettingsFile } from '../useSettingsFile';

type Lang = 'tr' | 'en';
const GROUPS: { id: MailGroup; icon: LucideIcon; tone: string }[] = [
  { id: 'Randevu talepleri', icon: Inbox, tone: 'kiremit' },
  { id: 'Danışanlar', icon: UsersRound, tone: 'adacayi' },
  { id: 'Ödemeler', icon: Wallet, tone: 'gunes' },
  { id: 'Bekleme listesi', icon: ClipboardList, tone: 'lavanta' },
  { id: 'Otomatik', icon: Clock3, tone: 'deniz' },
];

/** The window for one e-mail: both languages, placeholders, live preview. */
function TemplateDialog({ entry, texts, onSave, onClose }: { entry: CatalogEntry; texts: MailTexts; onSave: (t: { tr?: Mail; en?: Mail } | undefined) => void; onClose: () => void }) {
  const own = texts.templates?.[entry.id];
  const [lang, setLang] = useState<Lang>('tr');
  const [draft, setDraft] = useState<Record<Lang, Mail>>(() => ({ tr: own?.tr ?? defaultTemplate(entry, 'tr'), en: own?.en ?? defaultTemplate(entry, 'en') }));
  const [custom, setCustom] = useState<Record<Lang, boolean>>({ tr: !!own?.tr, en: !!own?.en });
  const body = useRef<HTMLTextAreaElement>(null);
  const set = (patch: Partial<Mail>) => {
    setDraft({ ...draft, [lang]: { ...draft[lang], ...patch } });
    setCustom({ ...custom, [lang]: true });
  };
  const insert = (key: string) => {
    const el = body.current;
    const text = draft[lang].body;
    const at = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    set({ body: `${text.slice(0, at)}{${key}}${text.slice(end)}` });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + key.length + 2, at + key.length + 2);
    });
  };
  const vars = { ...entry.vars(lang), imza: texts.signature?.[lang]?.trim() || DEFAULT_SIGNATURE[lang] };
  const preview = { subject: fill(draft[lang].subject, vars), body: fill(draft[lang].body, vars) };
  const reset = () => {
    setDraft({ ...draft, [lang]: defaultTemplate(entry, lang) });
    setCustom({ ...custom, [lang]: false });
  };
  return (
    <Dialog
      title={entry.label}
      onClose={onClose}
      actions={
        <>
          {!entry.auto && (
            <Button variant="ghost" className="mt-reset" onClick={reset} disabled={!custom[lang]}>
              <Icon as={RotateCcw} size={15} />
              Varsayılana dön
            </Button>
          )}
          <Button onClick={onClose}>{entry.auto ? 'Kapat' : 'Vazgeç'}</Button>
          {!entry.auto && (
            <Button
              variant="primary"
              onClick={() => {
                const next = { ...(custom.tr ? { tr: draft.tr } : {}), ...(custom.en ? { en: draft.en } : {}) };
                onSave(Object.keys(next).length ? next : undefined);
              }}
            >
              Tamam
            </Button>
          )}
        </>
      }
    >
      <div className="mt">
        <p className="k-hint mt-when">{entry.when}</p>
        <div className="segmented" role="group" aria-label="Dil">
          <button type="button" aria-pressed={lang === 'tr'} onClick={() => setLang('tr')}>
            {`Türkçe${custom.tr ? ' · size özel' : ''}`}
          </button>
          <button type="button" aria-pressed={lang === 'en'} onClick={() => setLang('en')}>
            {`İngilizce${custom.en ? ' · size özel' : ''}`}
          </button>
        </div>
        <div className="mt-grid">
          <div className="mt-edit">
            {entry.auto ? (
              <p className="k-hint">
                Bu e-postayı sistem kendiliğinden gönderir. Metni Google tarafında (Apps Script) durduğu için şimdilik buradan değiştirilemez; bir sonraki güncellemede bu ekrana bağlanabilir.
              </p>
            ) : (
              <>
                <label className="k-field">
                  <span className="k-label">Konu</span>
                  <input className="k-input" value={draft[lang].subject} onChange={(e) => set({ subject: e.target.value })} lang={lang} />
                </label>
                <label className="k-field">
                  <span className="k-label">Metin</span>
                  <textarea ref={body} className="k-input mt-body" rows={16} value={draft[lang].body} onChange={(e) => set({ body: e.target.value })} lang={lang} />
                </label>
                <div className="mt-chips" aria-label="Yer tutucular">
                  <span className="k-hint">Eklemek için basın:</span>
                  {PLACEHOLDERS.filter((p) => p.key === 'imza' || p.key in entry.vars(lang)).map((p) => (
                    <button key={p.key} type="button" className="mt-chip" onClick={() => insert(p.key)} title={p.label}>
                      {`{${p.key}}`}
                      <small>{p.label}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="mt-preview" aria-label="Önizleme">
            <span className="mt-preview-head">
              <Icon as={Eye} size={15} />
              {`Önizleme · ${lang === 'en' ? 'Anna Example' : 'Ayşe Örnek'} için`}
            </span>
            <b className="mt-subject">{entry.auto ? entry.sample(lang).subject : preview.subject}</b>
            <pre className="mt-text" lang={lang}>
              {entry.auto ? entry.sample(lang).body : preview.body}
            </pre>
          </div>
        </div>
      </div>
    </Dialog>
  );
}

export function EpostaScreen() {
  const file = useSettingsFile<MailTexts>('src/data/mail.json', parseMailTexts, 'E-posta Ayarları');
  const [open, setOpen] = useState<CatalogEntry | null>(null);
  // The panel's e-mails follow the saved file (after it loads and after each save).
  useEffect(() => {
    if (file.value && !file.dirty) setMailTexts(file.value);
  }, [file.value, file.dirty]);

  return (
    <SettingsForm
      title="E-posta Ayarları"
      screen="eposta"
      file={file}
      intro="Adresler, imza ve danışanlara giden hazır e-postalar. Hazır mesajları kendi üslubunuzla yeniden yazabilirsiniz; kişinin adı, tarih gibi bilgiler süslü parantezli yer tutucularla kendiliğinden doldurulur. Panelden gönderdiğiniz her e-postayı göndermeden önce yine görür ve düzenleyebilirsiniz."
    >
      {(t) => (
        <>
          <h3>Adresler</h3>
          <div className="mail-boxes-wrap">
            <MailboxesCard />
          </div>

          <h3>İmza</h3>
          <LocalizedField
            label="İmza satırları"
            value={t.signature ?? DEFAULT_SIGNATURE}
            onChange={(v) => file.setValue((x) => ({ ...x, signature: v.tr.trim() === DEFAULT_SIGNATURE.tr && v.en.trim() === DEFAULT_SIGNATURE.en ? undefined : v }))}
            multiline
            hint="“Saygılarımla,” satırının altındaki satırlar: ad, unvan, site. Bütün hazır e-postalarda kullanılır."
          />

          <h3>Hazır mesajlar</h3>
          <div className="mt-groups">
            {GROUPS.map((g) => (
              <section key={g.id} className="mt-group">
                <h4 className={`mt-group-title tone-${g.tone}`}>
                  <span className="tone-tile tone-tile-sm" aria-hidden="true">
                    <Icon as={g.icon} size={15} />
                  </span>
                  {g.id === 'Otomatik' ? 'Otomatik e-postalar' : g.id}
                </h4>
                <ul>
                  {MAIL_CATALOG.filter((e) => e.group === g.id).map((e) => {
                    const own = t.templates?.[e.id];
                    return (
                      <li key={e.id}>
                        <button type="button" className="row-list-row" onClick={() => setOpen(e)}>
                          <span className={`tone-tile tone-${g.tone}`} aria-hidden="true">
                            <Icon as={MailIcon} size={16} />
                          </span>
                          <span className="row-list-text">
                            <b>{e.label}</b>
                            <span>{e.when}</span>
                          </span>
                          <span className="row-list-marks">
                            {e.auto ? (
                              <span className="tone-chip tone-deniz">Otomatik</span>
                            ) : own ? (
                              <span className="tone-chip tone-gunes">
                                <Icon as={Sparkles} size={12} />
                                {`Size özel${own.tr && own.en ? '' : own.tr ? ' · TR' : ' · EN'}`}
                              </span>
                            ) : (
                              <span className="tone-chip tone-lacivert">Varsayılan</span>
                            )}
                          </span>
                          <Icon as={ChevronRight} size={18} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <h3>Teşekkür cümleleri</h3>
          <LocalizedField
            label="Cümleler (her satıra bir cümle)"
            value={{ tr: (t.motivation?.tr ?? MOTIVATION_DEFAULTS.tr).join('\n'), en: (t.motivation?.en ?? MOTIVATION_DEFAULTS.en).join('\n') }}
            onChange={(v) => {
              const lines = (x: string) => x.split('\n').map((l) => l.trim()).filter(Boolean);
              file.setValue((x) => ({ ...x, motivation: { tr: lines(v.tr), en: lines(v.en) } }));
            }}
            multiline
            hint="“Ödeme alındı” e-postasında bunlardan biri seçilir; aynı seans için hep aynısı."
          />

          {open && (
            <TemplateDialog
              entry={open}
              texts={t}
              onClose={() => setOpen(null)}
              onSave={(own) => {
                file.setValue((x) => {
                  const templates = { ...(x.templates ?? {}) };
                  if (own) templates[open.id] = own;
                  else delete templates[open.id];
                  return { ...x, templates: Object.keys(templates).length ? templates : undefined };
                });
                setOpen(null);
              }}
            />
          )}
        </>
      )}
    </SettingsForm>
  );
}

