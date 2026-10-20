/** Messages the booking and intro-call forms share (e-mail check, "Haber et"). */
export const FORM_TEXT = {
  tr: {
    mismatch: 'İki e-posta adresi aynı değil. Lütfen kontrol edin.',
    mail2: 'E-posta (tekrar)',
    mail2Hint: 'Yanlış yazılmış bir adrese yanıt ulaşmaz; lütfen yeniden yazın.',
    verified: 'Teşekkürler, e-posta adresiniz doğrulandı. Size bu adresten yazacağım.',
    verifyFailed: 'Bu doğrulama bağlantısı açılamadı. E-postadaki bağlantıyı yeniden açmayı deneyin ya da doğrudan e-posta gönderin.',
  },
  en: {
    mismatch: 'The two e-mail addresses do not match. Please check them.',
    mail2: 'E-mail (again)',
    mail2Hint: 'A reply cannot reach a mistyped address; please type it again.',
    verified: 'Thank you, your e-mail address is confirmed. I will write to you there.',
    verifyFailed: 'This confirmation link could not be opened. Try the link in the e-mail again, or write to me directly.',
  },
} as const;
