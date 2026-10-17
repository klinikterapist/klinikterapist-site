/**
 * Public panel settings (no secrets): the Apps Script web app URL and the Google OAuth client ID.
 * Filled in during setup (docs/kurulum/yonetim-paneli.md). Empty values show "Panel henüz kurulmadı".
 */
export type AdminConfig = { apiUrl: string; googleClientId: string; ownerEmail: string };

export const ADMIN_CONFIG: AdminConfig = {
  apiUrl: '',
  googleClientId: '617877268772-jdl3mf9em8g59vcr0hrds5cejm3hrrvt.apps.googleusercontent.com',
  ownerEmail: 'merhaba@klinikterapist.com',
};

/** `apiUrl` value that selects the in-memory development backend. */
export const MOCK_API_URL = 'mock';
