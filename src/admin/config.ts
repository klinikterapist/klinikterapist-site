/**
 * Public panel settings (no secrets): the Apps Script web app URL and the Google OAuth client ID.
 * Filled in during setup (docs/kurulum/yonetim-paneli.md). Empty values show "Panel henüz kurulmadı".
 */
export type AdminConfig = { apiUrl: string; googleClientId: string; ownerEmail: string };

export const ADMIN_CONFIG: AdminConfig = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbzwSOo-v6NnOA143gn18CcN2KtJ6SAwJcDsu5t5m1Au2OqcmF2eXLRoUZiu3A3xPPBd/exec',
  googleClientId: '617877268772-inqev9udioeq5u2uttm1nig4fik1jv8e.apps.googleusercontent.com',
  ownerEmail: 'merhaba@klinikterapist.com',
};

/** `apiUrl` value that selects the in-memory development backend. */
export const MOCK_API_URL = 'mock';
