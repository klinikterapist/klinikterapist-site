/** Messages the booking and intro-call forms share (e-mail check, "Haber et"). */
export const FORM_TEXT = {
  tr: {
    mismatch: 'İki e-posta adresi aynı değil. Lütfen kontrol edin.',
    emailDomain: 'Bu e-posta adresinin alan adı e-posta almıyor görünüyor (örneğin "gmial.com"). Lütfen adresinizi kontrol edin.',
    mail2: 'E-posta (tekrar)',
    mail2Hint: 'Yanlış yazılmış bir adrese yanıt ulaşmaz; lütfen yeniden yazın.',
  },
  en: {
    mismatch: 'The two e-mail addresses do not match. Please check them.',
    emailDomain: 'The domain of this e-mail address does not seem to take e-mail (for example "gmial.com"). Please check your address.',
    mail2: 'E-mail (again)',
    mail2Hint: 'A reply cannot reach a mistyped address; please type it again.',
  },
} as const;
