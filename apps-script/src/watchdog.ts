/**
 * "Saatlik görev durdu" warning (night review B2-3). The hourly run stamps `hourly.lastRun`; any
 * request to the web app checks the stamp, at most every 10 minutes (through the cache). When the
 * run is more than 3 hours late the owner gets one e-mail, again at most once a day while it stays
 * stopped. Before the first run there is no stamp and nothing is said.
 *
 * Without the hourly run, scheduled posts are not published, session and payment reminders do not go
 * out, the 20-hour warning on undecided requests is not sent and the counter is not rolled up.
 */
import type { Gas } from './gas';
import { notifyTo } from './mailboxes';

export const LAST_RUN = 'hourly.lastRun';
const WARNED = 'hourly.warnedAt';
const CHECKED = 'hourly.checked';
export const STALE_MS = 3 * 3600e3;
const AGAIN_MS = 24 * 3600e3;

/** Istanbul time, `21.10.2026 14:05`. */
const istanbul = (ms: number) => {
  const iso = new Date(ms + 3 * 3600e3).toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
};

export function stampHourly(gas: Gas): void {
  gas.props.set(LAST_RUN, String(gas.now()));
  gas.props.del(WARNED);
}

export function checkHourly(gas: Gas): void {
  if (gas.cache.get(CHECKED)) return;
  gas.cache.put(CHECKED, '1', 600);
  const last = Number(gas.props.get(LAST_RUN)) || 0;
  const now = gas.now();
  if (!last || now - last < STALE_MS) return;
  if (now - (Number(gas.props.get(WARNED)) || 0) < AGAIN_MS) return;
  const owner = gas.props.get('OWNER_EMAIL')?.trim();
  if (!owner) return;
  gas.props.set(WARNED, String(now));
  gas.mail.send({
    to: notifyTo(gas, owner),
    replyTo: owner,
    name: 'klinikterapist.com randevu sistemi',
    subject: '[klinikterapist] Saatlik görev durmuş görünüyor',
    body: [
      `Panelin saatlik görevi en son ${istanbul(last)} saatinde çalıştı (${Math.floor((now - last) / 3600e3)} saat önce).`,
      '',
      'Görev çalışmadıkça:',
      '- planladığınız yazılar yayınlanmaz,',
      '- danışanlara seans ve ödeme hatırlatmaları gitmez,',
      '- kararsız kalan talepler için uyarı gelmez.',
      '',
      'Ne yapmalı:',
      '1. script.google.com › "Klinikterapist Panel" projesini açın.',
      '2. Soldaki saat simgesine (Tetikleyiciler) bakın: "hourly" için saatlik bir tetikleyici olmalı.',
      '3. Düzenleyicide üstteki listeden "hourly" işlevini seçip bir kez "Çalıştır"a basın; izin isterse verin.',
      'Ayrıntı: docs/kurulum/yonetim-paneli.md, 7. bölüm.',
      '',
      'Görev yeniden çalışınca bu uyarı kendiliğinden kapanır. Durmaya devam ederse günde en fazla bir kez yeniden yazarım.',
    ].join('\n'),
  });
}
