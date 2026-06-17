export interface ApiError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly type: string;

  constructor(status: number, body: ApiError) {
    super(body.error.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.error.code;
    this.type = body.error.type;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  // The server may return non-JSON bodies (HTML error pages from a proxy,
  // a plain text maintenance page, an empty body, etc.). Only attempt to
  // parse the body as JSON when the response advertises it; fall back to a
  // structured ApiError otherwise so callers always get an ApiClientError.
  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.toLowerCase().includes('application/json');
  let parsed: unknown = undefined;
  if (isJson && text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }
  if (!res.ok) {
    const err: ApiError = isApiErrorShape(parsed)
      ? parsed
      : {
          error: {
            message: text ? truncate(text, 500) : `HTTP ${res.status}`,
            type: 'http_error',
            code: 'http_error',
          },
        };
    throw new ApiClientError(res.status, err);
  }
  // For 2xx with a non-JSON body we return undefined; callers that need a
  // specific shape can validate the result. This still surfaces a clean
  // success in the common "204 / empty body" case.
  return (parsed as T) ?? (undefined as T);
}

function isApiErrorShape(value: unknown): value is ApiError {
  if (!value || typeof value !== 'object') return false;
  const err = (value as { error?: unknown }).error;
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: unknown; type?: unknown; code?: unknown };
  return typeof e.message === 'string' && typeof e.type === 'string' && typeof e.code === 'string';
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n)}...`;
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  delete: <T>(url: string) => request<T>('DELETE', url),
};
