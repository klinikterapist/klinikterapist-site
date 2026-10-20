/** The ready e-mail, open for editing before it goes (Randevu talepleri and Seans takip). */
import type { ReactNode } from 'react';
import type { Mail } from '../../lib/booking-mail';
import { Button, Dialog, Field } from '../kit';

export function MailDialog(props: {
  title: string;
  to: { name: string; email: string };
  mail: Mail;
  onMail: (m: Mail) => void;
  send: string;
  tone?: 'primary' | 'danger';
  busy: boolean;
  onSend: () => void;
  onClose: () => void;
  /** Above the e-mail: what happens when it goes, or a choice between e-mails. */
  children?: ReactNode;
}) {
  const { mail, onMail, busy } = props;
  return (
    <Dialog
      title={props.title}
      history
      onClose={() => !busy && props.onClose()}
      actions={
        <>
          <Button onClick={props.onClose} disabled={busy}>
            Vazgeç
          </Button>
          <Button variant={props.tone ?? 'primary'} busy={busy} onClick={props.onSend}>
            {props.send}
          </Button>
        </>
      }
    >
      {props.children}
      <p className="mail-to">
        <span>Alıcı</span>
        <b>{props.to.name}</b> &lt;{props.to.email}&gt;
      </p>
      <div className="stack">
        <Field label="Konu" value={mail.subject} onChange={(subject) => onMail({ ...mail, subject })} maxLength={200} />
        <Field label="E-posta metni" multiline rows={12} value={mail.body} onChange={(body) => onMail({ ...mail, body })} maxLength={5000} />
      </div>
      <p className="k-hint">Göndermeden önce metni düzeltebilirsiniz.</p>
    </Dialog>
  );
}
