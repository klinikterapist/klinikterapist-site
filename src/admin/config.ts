/**
 * Public panel settings (no secrets): the Apps Script web app URL and the Google OAuth client ID.
 * Filled in during setup (docs/kurulum/yonetim-paneli.md). Empty values show "Panel henüz kurulmadı".
 */
export type AdminConfig = { apiUrl: string; googleClientId: string; ownerEmail: string };

export const ADMIN_CONFIG: AdminConfig = {
  apiUrl: '',
  googleClientId: '',
  ownerEmail: 'merhaba@klinikterapist.com',
};

/** `apiUrl` value that selects the in-memory development backend. */
export const MOCK_API_URL = 'mock';
