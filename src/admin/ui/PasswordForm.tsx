/**
 * The panel's own user name and password, the first lock of sign-in (owner's decision 2026-10-22).
 * Used once right after the first Google sign-in (no password yet) and in Ayarlar › Giriş Bilgileri.
 */
import { useState, type FormEvent } from 'react';
import { ApiFailure } from '../api/types';
import { usePanel } from './context';
import { Banner, Button, Field } from './kit';

export const MIN_PASSWORD = 10;

export function PasswordForm({ change, onDone }: { change: boolean; onDone: () => void }) {
  const { api } = usePanel();
  const [current, setCurrent] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const problem =
      change && !current
        ? 'Şu anki şifrenizi girin.'
        : username.trim().length < 3
          ? 'Kullanıcı adı en az 3 karakter olmalı.'
          : password.length < MIN_PASSWORD
            ? `Şifre en az ${MIN_PASSWORD} karakter olmalı.`
            : password !== repeat
              ? 'İki şifre birbirini tutmuyor.'
              : null;
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.setPassword({ username, password, ...(change ? { current } : {}) });
      setCurrent('');
      setPassword('');
      setRepeat('');
      onDone();
    } catch (err) {
      setError(err instanceof ApiFailure ? err.message : 'Kaydedilemedi. Biraz sonra tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="login-form" onSubmit={submit} noValidate>
      {change && <Field label="Şu anki şifre" type="password" value={current} onChange={setCurrent} autoComplete="current-password" />}
      <Field label={change ? 'Yeni kullanıcı adı' : 'Kullanıcı adı'} value={username} onChange={setUsername} autoComplete="username" hint="Büyük-küçük harf fark etmez. E-posta adresiniz olmasın." />
      <Field label={change ? 'Yeni şifre' : 'Şifre'} type="password" value={password} onChange={setPassword} autoComplete="new-password" hint={`En az ${MIN_PASSWORD} karakter. Başka bir yerde kullanmadığınız bir şifre seçin.`} />
      <Field label="Şifre (tekrar)" type="password" value={repeat} onChange={setRepeat} autoComplete="new-password" />
      <Button type="submit" variant="primary" busy={busy}>
        {change ? 'Değiştir' : 'Kaydet'}
      </Button>
      {error && <Banner tone="error">{error}</Banner>}
    </form>
  );
}
