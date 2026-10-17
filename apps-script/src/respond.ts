import type { ApiResponse, ErrorCode } from '../../src/admin/api/types';

/** An error the panel may show: `message` is Turkish and safe to display. */
export class ApiError extends Error {
  constructor(
    readonly code: Exclude<ErrorCode, 'network'>,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const INTERNAL_MESSAGE = 'Beklenmeyen bir hata oldu. Biraz sonra tekrar deneyin.';

export const ok = <T>(data: T): ApiResponse<T> => ({ ok: true, data });

export function fail(e: ApiError): ApiResponse<never> {
  return e.data === undefined
    ? { ok: false, error: { code: e.code, message: e.message } }
    : { ok: false, error: { code: e.code, message: e.message }, data: e.data };
}

export const badRequest = (message = 'İstek anlaşılamadı. Sayfayı yenileyip tekrar deneyin.') => new ApiError('bad_request', message);
