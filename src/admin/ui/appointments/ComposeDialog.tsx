/**
 * "Danışana e-posta" (owner's reviews 2026-10-23): one window to write to a client from Danışanlar.
 * - Kime: search the clients by number, name or e-mail and pick one (nothing is picked at first, so a
 *   message cannot go to the first client in the list by mistake); the chosen client shows as a card.
 * - Konu türü: homework, a message, a resource, information, other, as coloured choices; each starts
 *   with its own subject and opening, in the client's language. Once the owner has changed the text, a
 *   new choice no longer overwrites it ("Hazır metni uygula" does, on request).
 * - Yaz / Önizle: the message with a character count, and how the e-mail will look.
 * - Ekler: drop files or pick them (homework sheets, readings), with the room left of the limit.
 * The e-mail goes from the booking address to the client's address only (clients.mail), with the signature.
 */
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { ApiFailure, type Client, type MailAttachment } from '../../api/types';
import { signature } from '../../../lib/mail-texts';
import { usePanel } from '../context';
import { BookOpen, ClipboardList, Eye, FileText, Icon, Image, Info, MessagesSquare, Paperclip, PencilLine, Search, Send, Upload, X, type LucideIcon } from '../icons';
import { Banner, Button, Dialog, Field } from '../kit';
import { ATTACH_LIMITS } from '../../../lib/attachments';

type Kind = 'odev' | 'mesaj' | 'kaynak' | 'bilgi' | 'diger';
type FileItem = MailAttachment & { size: number };

const KINDS: { value: Kind; label: string; icon: LucideIcon; tone: string }[] = [
  { value: 'odev', label: 'Ödev', icon: ClipboardList, tone: 'adacayi' },
  { value: 'mesaj', label: 'Mesaj', icon: MessagesSquare, tone: 'lavanta' },
  { value: 'kaynak', label: 'Kaynak önerisi', icon: BookOpen, tone: 'deniz' },
  { value: 'bilgi', label: 'Bilgilendirme', icon: Info, tone: 'gunes' },
  { value: 'diger', label: 'Diğer', icon: PencilLine, tone: 'kiremit' },
];

const TEXT: Record<'tr' | 'en', Record<Kind, { subject: string; open: string }>> = {
  tr: {
    odev: { subject: 'Ödeviniz – klinikterapist.com', open: 'Bir sonraki seansımıza kadar üzerinde çalışmanız için ödevinizi aşağıda bulabilirsiniz.' },
    mesaj: { subject: 'Bir mesajım var – klinikterapist.com', open: '' },
    kaynak: { subject: 'Size bir kaynak önerim var – klinikterapist.com', open: 'Seansımızda konuştuklarımızla ilgili okumanızı önerdiğim kaynağı aşağıda paylaşıyorum.' },
    bilgi: { subject: 'Bilgilendirme – klinikterapist.com', open: '' },
    diger: { subject: '', open: '' },
  },
  en: {
    odev: { subject: 'Your homework – klinikterapist.com', open: 'Here is your homework to work on until our next session.' },
    mesaj: { subject: 'A message from me – klinikterapist.com', open: '' },
    kaynak: { subject: 'A resource for you – klinikterapist.com', open: 'Here is the resource I suggested, related to what we talked about in our session.' },
    bilgi: { subject: 'Information – klinikterapist.com', open: '' },
    diger: { subject: '', open: '' },
  },
};

const BODY_MAX = 5000;

function draft(c: Client | undefined, kind: Kind) {
  const lang = c?.contact.lang ?? 'tr';
  const t = TEXT[lang][kind];
  const hello = lang === 'en' ? `Dear ${c?.contact.name.trim() ?? ''},` : `Sayın ${c?.contact.name.trim() ?? ''},`;
  const close = lang === 'en' ? 'Kind regards,' : 'Saygılarımla,';
  const body = [hello, '', ...(t.open ? [t.open, '', ''] : ['', '']), close, signature(lang)].join('\n');
  return { subject: t.subject, body };
}

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const size = (n: number) => (n >= 1e6 ? `${(n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`);
const fold = (s: string) => s.toLocaleLowerCase('tr-TR');
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase('tr-TR') ?? '')
    .join('') || '?';

export function ComposeDialog({ clients, onClose, onSent, initial }: { clients: Client[]; onClose: () => void; onSent: (message: string) => void; initial?: string }) {
  const { api } = usePanel();
  const list = useMemo(() => [...clients].sort((a, b) => a.number.localeCompare(b.number)), [clients]);
  const [id, setId] = useState(initial ?? '');
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState(!initial);
  const [kind, setKind] = useState<Kind>('mesaj');
  const client = list.find((c) => c.id === id);
  const [mail, setMail] = useState(() => draft(client, 'mesaj'));
  const [touched, setTouched] = useState({ subject: false, body: false });
  const [view, setView] = useState<'write' | 'preview'>('write');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const total = files.reduce((n, f) => n + f.size, 0);
  const found = list.filter((c) => !query.trim() || [c.number, c.contact.name, c.contact.email].some((v) => fold(v).includes(fold(query.trim()))));

  /** A new client or kind: the ready text again, except where the owner has written their own. */
  const redraft = (nextId: string, nextKind: Kind, force = false) => {
    const d = draft(
      list.find((c) => c.id === nextId),
      nextKind,
    );
    setMail((m) => ({ subject: force || !touched.subject ? d.subject : m.subject, body: force || !touched.body ? d.body : m.body }));
    if (force) setTouched({ subject: false, body: false });
  };

  const choose = (nextId: string) => {
    setId(nextId);
    setPicking(false);
    setQuery('');
    redraft(nextId, kind);
  };

  const add = async (picked: FileList | File[] | null) => {
    setError(null);
    const next = [...files];
    for (const f of Array.from(picked ?? [])) {
      if (next.length >= ATTACH_LIMITS.count) {
        setError(`En çok ${ATTACH_LIMITS.count} dosya eklenebilir.`);
        break;
      }
      if (!ATTACH_LIMITS.types.includes(f.type)) {
        setError(`"${f.name}" eklenemedi: PDF, Word, Excel, PowerPoint, metin, JPG ya da PNG dosyası seçin.`);
        continue;
      }
      if (next.reduce((n, x) => n + x.size, 0) + f.size > ATTACH_LIMITS.bytes) {
        setError(`Eklerin toplamı ${size(ATTACH_LIMITS.bytes)}'ı geçemez.`);
        continue;
      }
      next.push({ name: f.name, type: f.type, data: await readAsBase64(f), size: f.size });
    }
    setFiles(next);
  };

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    add(e.dataTransfer.files);
  };

  const send = async () => {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      await api.clientMail({ id: client.id, ...mail, ...(files.length ? { attachments: files.map(({ name, type, data }) => ({ name, type, data })) } : {}) });
      onSent(`${client.number} numaralı danışana e-posta gönderildi${files.length ? ` (${files.length} ek ile)` : ''}.`);
    } catch (e) {
      setError(e instanceof ApiFailure ? e.message : 'Gönderilemedi. Tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  const ready = !!client && !!mail.subject.trim() && !!mail.body.trim();

  return (
    <Dialog
      title="Danışana e-posta"
      size="wide"
      history
      onClose={() => !busy && onClose()}
      actions={
        <>
          <span className="cm-summary k-hint">{client ? `Kime: ${client.number}${files.length ? ` · ${files.length} ek, ${size(total)}` : ''}` : 'Önce danışanı seçin.'}</span>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="primary" busy={busy} disabled={!ready} onClick={send}>
            <Icon as={Send} size={16} />
            Gönder
          </Button>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      {list.length === 0 ? (
        <p>Henüz danışan yok.</p>
      ) : (
        <div className="cm">
          <section className="cm-block" aria-labelledby="cm-to">
            <h3 id="cm-to" className="cm-label">
              Kime
            </h3>
            {client && !picking ? (
              <div className="cm-client">
                <span className="cm-avatar" aria-hidden="true">
                  {initials(client.contact.name)}
                </span>
                <span className="cm-who">
                  <b>{client.contact.name}</b>
                  <span>{`${client.number} · ${client.contact.email}`}</span>
                </span>
                <span className="cm-lang">{client.contact.lang === 'en' ? 'İngilizce' : 'Türkçe'}</span>
                <Button variant="ghost" onClick={() => setPicking(true)}>
                  Değiştir
                </Button>
              </div>
            ) : (
              <div className="cm-pick">
                <label className="cm-search">
                  <Icon as={Search} size={16} />
                  <input
                    className="k-input"
                    type="search"
                    placeholder="Numara, ad ya da e-posta"
                    aria-label="Danışan ara"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <ul className="cm-results" role="listbox" aria-label="Danışan">
                  {found.map((c) => (
                    <li key={c.id}>
                      <button type="button" role="option" aria-selected={c.id === id} onClick={() => choose(c.id)}>
                        <span className="cm-avatar" aria-hidden="true">
                          {initials(c.contact.name)}
                        </span>
                        <span className="cm-who">
                          <b>{c.number}</b>
                          <span>{c.contact.email}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {!found.length && <li className="k-hint cm-none">Bu aramayla eşleşen danışan yok.</li>}
                </ul>
              </div>
            )}
          </section>

          <section className="cm-block" aria-labelledby="cm-kind">
            <h3 id="cm-kind" className="cm-label">
              Konu türü
            </h3>
            <div className="cm-kinds" role="radiogroup" aria-labelledby="cm-kind">
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.value}
                  className={`cm-kind tone-${k.tone}`}
                  onClick={() => {
                    setKind(k.value);
                    redraft(id, k.value);
                  }}
                >
                  <Icon as={k.icon} size={16} />
                  {k.label}
                </button>
              ))}
            </div>
          </section>

          <section className="cm-block cm-letter" aria-label="E-posta">
            <div className="cm-letter-head">
              <div className="segmented" role="tablist" aria-label="Görünüm">
                <button type="button" role="tab" aria-selected={view === 'write'} onClick={() => setView('write')}>
                  <Icon as={PencilLine} size={15} />
                  Yaz
                </button>
                <button type="button" role="tab" aria-selected={view === 'preview'} onClick={() => setView('preview')}>
                  <Icon as={Eye} size={15} />
                  Önizle
                </button>
              </div>
              {(touched.subject || touched.body) && (
                <Button variant="ghost" onClick={() => redraft(id, kind, true)}>
                  Hazır metni uygula
                </Button>
              )}
            </div>

            {view === 'write' ? (
              <>
                <Field
                  label="Konu"
                  value={mail.subject}
                  maxLength={200}
                  placeholder="E-postanın konusu"
                  onChange={(subject) => {
                    setMail({ ...mail, subject });
                    setTouched((t) => ({ ...t, subject: true }));
                  }}
                />
                <Field
                  label="Mesaj"
                  multiline
                  rows={11}
                  inputClassName="cm-body"
                  value={mail.body}
                  maxLength={BODY_MAX}
                  hint={`${mail.body.length.toLocaleString('tr-TR')} / ${BODY_MAX.toLocaleString('tr-TR')} karakter`}
                  onChange={(body) => {
                    setMail({ ...mail, body });
                    setTouched((t) => ({ ...t, body: true }));
                  }}
                />
              </>
            ) : (
              <article className="cm-preview" aria-label="Önizleme">
                <dl>
                  <dt>Kime</dt>
                  <dd>{client ? client.contact.email : '—'}</dd>
                  <dt>Konu</dt>
                  <dd>
                    <b>{mail.subject || '(konu yok)'}</b>
                  </dd>
                </dl>
                <div className="cm-preview-body">{mail.body}</div>
                {files.length > 0 && (
                  <ul className="cm-preview-files">
                    {files.map((f, i) => (
                      <li key={`${f.name}${i}`}>
                        <Icon as={Paperclip} size={13} />
                        {f.name}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            )}
          </section>

          <section className="cm-block" aria-labelledby="cm-files">
            <h3 id="cm-files" className="cm-label">
              Ekler <span className="k-hint">{`(isteğe bağlı · ${files.length}/${ATTACH_LIMITS.count})`}</span>
            </h3>
            <div
              className={`cm-drop${over ? ' is-over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={drop}
            >
              <Icon as={Upload} size={20} />
              <span>
                Dosyaları buraya bırakın ya da{' '}
                <button type="button" className="linklike" onClick={() => picker.current?.click()} disabled={files.length >= ATTACH_LIMITS.count}>
                  bilgisayardan seçin
                </button>
              </span>
              <small>{`PDF, Word, Excel, PowerPoint, metin, JPG ya da PNG · toplam en çok ${size(ATTACH_LIMITS.bytes)}`}</small>
              <input ref={picker} type="file" multiple hidden accept={ATTACH_LIMITS.types.join(',')} onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
            </div>
            {files.length > 0 && (
              <>
                <ul className="cm-files">
                  {files.map((f, i) => (
                    <li key={`${f.name}${i}`}>
                      <span className="cm-file-icon" aria-hidden="true">
                        <Icon as={f.type.startsWith('image/') ? Image : FileText} size={16} />
                      </span>
                      <span className="cm-file-name">{f.name}</span>
                      <small>{size(f.size)}</small>
                      <button type="button" aria-label={`${f.name} ekini kaldır`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                        <Icon as={X} size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="cm-meter" aria-label={`Kullanılan: ${size(total)} / ${size(ATTACH_LIMITS.bytes)}`}>
                  <span style={{ width: `${Math.min(100, (total / ATTACH_LIMITS.bytes) * 100)}%` }} />
                </div>
              </>
            )}
          </section>

          <p className="k-hint cm-note">E-posta yalnızca seçtiğiniz danışanın adresine, randevu adresinizden gider. Göndermeden önce Önizle ile son hâline bakabilirsiniz.</p>
        </div>
      )}
    </Dialog>
  );
}
