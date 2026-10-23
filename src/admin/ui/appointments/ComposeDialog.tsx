/**
 * "Danışana e-posta" (owner's review 2026-10-23): one window to write to a client from Danışanlar. Pick
 * the client, the kind of message (homework, a message, a resource, information, other: each starts
 * with its own subject and opening), write, and attach files (homework sheets, readings). The e-mail goes
 * from the booking address to the client's address only (clients.mail), with the signature.
 */
import { useMemo, useRef, useState } from 'react';
import { ApiFailure, type Client, type MailAttachment } from '../../api/types';
import { signature } from '../../../lib/mail-texts';
import { usePanel } from '../context';
import { Icon, Paperclip, X } from '../icons';
import { Banner, Button, Dialog, Field, Select } from '../kit';
import { ATTACH_LIMITS } from '../../../lib/attachments';

type Kind = 'odev' | 'mesaj' | 'kaynak' | 'bilgi' | 'diger';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'odev', label: 'Ödev' },
  { value: 'mesaj', label: 'Mesaj' },
  { value: 'kaynak', label: 'Kaynak önerisi' },
  { value: 'bilgi', label: 'Bilgilendirme' },
  { value: 'diger', label: 'Diğer' },
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

export function ComposeDialog({ clients, onClose, onSent, initial }: { clients: Client[]; onClose: () => void; onSent: (message: string) => void; initial?: string }) {
  const { api } = usePanel();
  const list = useMemo(() => [...clients].sort((a, b) => a.number.localeCompare(b.number)), [clients]);
  const [id, setId] = useState(initial ?? list[0]?.id ?? '');
  const [kind, setKind] = useState<Kind>('mesaj');
  const client = list.find((c) => c.id === id);
  const [mail, setMail] = useState(() => draft(client, 'mesaj'));
  const [files, setFiles] = useState<(MailAttachment & { size: number })[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const total = files.reduce((n, f) => n + f.size, 0);

  const restart = (nextId: string, nextKind: Kind) => {
    setId(nextId);
    setKind(nextKind);
    setMail(draft(list.find((c) => c.id === nextId), nextKind));
  };

  const add = async (picked: FileList | null) => {
    setError(null);
    const chosen = Array.from(picked ?? []);
    const next = [...files];
    for (const f of chosen) {
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

  return (
    <Dialog
      title="Danışana e-posta"
      history
      onClose={() => !busy && onClose()}
      actions={
        <>
          <Button onClick={onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant="primary" busy={busy} disabled={!client || !mail.subject.trim() || !mail.body.trim()} onClick={send}>
            Gönder
          </Button>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      {list.length === 0 ? (
        <p>Henüz danışan yok.</p>
      ) : (
        <div className="stack compose">
          <div className="add-grid">
            <Select label="Danışan" value={id} options={list.map((c) => ({ value: c.id, label: `${c.number} · ${c.contact.email}` }))} onChange={(v) => restart(v, kind)} />
            <Select label="Konu türü" value={kind} options={KINDS} onChange={(v) => restart(id, v)} />
          </div>
          <Field label="Konu" value={mail.subject} maxLength={200} onChange={(subject) => setMail({ ...mail, subject })} />
          <Field label="Mesaj" multiline rows={10} value={mail.body} maxLength={5000} onChange={(body) => setMail({ ...mail, body })} />
          <div className="compose-files">
            <Button onClick={() => picker.current?.click()} disabled={files.length >= ATTACH_LIMITS.count}>
              <Icon as={Paperclip} size={16} />
              Dosya ekle
            </Button>
            <span className="k-hint">{`PDF, Word, Excel, PowerPoint, metin, JPG ya da PNG; en çok ${ATTACH_LIMITS.count} dosya, toplam ${size(ATTACH_LIMITS.bytes)}.`}</span>
            <input ref={picker} type="file" multiple hidden accept={ATTACH_LIMITS.types.join(',')} onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
          </div>
          {files.length > 0 && (
            <ul className="compose-list">
              {files.map((f, i) => (
                <li key={`${f.name}${i}`}>
                  <Icon as={Paperclip} size={14} />
                  <span>{f.name}</span>
                  <small>{size(f.size)}</small>
                  <button type="button" aria-label={`${f.name} ekini kaldır`} onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <Icon as={X} size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="k-hint">E-posta yalnızca seçtiğiniz danışanın adresine, randevu adresinizden gider. Göndermeden önce metni düzeltebilirsiniz.</p>
        </div>
      )}
    </Dialog>
  );
}
