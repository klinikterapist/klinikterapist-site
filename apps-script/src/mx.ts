/**
 * Mistyped e-mail addresses (owner's decision 2026-10-20, Faz 3): beside typing the address twice
 * and the near-miss domain fix on the page, the backend asks DNS whether the address's domain
 * takes e-mail at all (an MX record, or else an address record). "ayse@gmial.con" is stopped
 * before any e-mail goes. Google's public DNS-over-HTTPS answers; the result is cached for six
 * hours per domain. When DNS cannot be asked, the address is let through: a real person must
 * never be turned away by an outage.
 */
import type { Gas } from './gas';
import { ApiError } from './respond';

const TTL = 6 * 3600;

type DnsAnswer = { Status?: number; Answer?: unknown[] };

function ask(gas: Gas, domain: string, type: 'MX' | 'A'): DnsAnswer | null {
  try {
    const res = gas.fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`, { method: 'get' });
    if (res.code !== 200) return null;
    return JSON.parse(res.text) as DnsAnswer;
  } catch {
    return null;
  }
}

/** Whether the domain of `email` takes e-mail; true when DNS cannot say. */
export function domainTakesMail(gas: Gas, email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return false;
  const key = `mx:${domain}`;
  const cached = gas.cache.get(key);
  if (cached === '1' || cached === '0') return cached === '1';
  // DNS cannot answer: let the address through, and do not ask again for five minutes.
  const unknown = () => (gas.cache.put(key, '1', 300), true);
  const mx = ask(gas, domain, 'MX');
  if (!mx) return unknown();
  // 3: the domain does not exist.
  let ok = mx.Status === 0 && Array.isArray(mx.Answer) && mx.Answer.length > 0;
  if (!ok && mx.Status === 0) {
    const a = ask(gas, domain, 'A');
    if (!a) return unknown();
    ok = a.Status === 0 && Array.isArray(a.Answer) && a.Answer.length > 0;
  }
  gas.cache.put(key, ok ? '1' : '0', TTL);
  return ok;
}

/** Stops a form whose address cannot take e-mail; the page shows its own text (`reason: 'email'`). */
export function assertMailDomain(gas: Gas, email: string): void {
  if (!domainTakesMail(gas, email)) {
    throw new ApiError('bad_request', 'Bu e-posta adresinin alan adı e-posta almıyor görünüyor. Lütfen adresi kontrol edin.', { reason: 'email' });
  }
}
