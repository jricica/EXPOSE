const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

let authToken: string | null = null;

export const setToken = (token: string | null) => {
  authToken = token;
};

type RequestOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

class HttpError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

const buildUrl = (path: string, params?: Record<string, unknown>) => {
  const url = new URL(path, API_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.append(key, String(value));
    });
  }
  return url.toString();
};

const request = async <T>(
  path: string,
  { method, body, headers }: RequestOptions,
  params?: Record<string, unknown>
): Promise<T> => {
  const url = buildUrl(path, params);

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (authToken) {
    finalHeaders.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message = isJson && payload && typeof payload === 'object' && 'message' in (payload as any)
      ? String((payload as any).message)
      : response.statusText || 'Request failed';
    throw new HttpError(response.status, message, payload);
  }

  return payload as T;
};

export const get = <T>(path: string, params?: Record<string, unknown>) =>
  request<T>(path, { method: 'GET' }, params);

export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body });

export const put = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PUT', body });

export const del = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'DELETE', body });

export { HttpError };
