const rawBase = import.meta.env.VITE_API_URL?.trim();
const API_BASE_URL = (() => {
  if (rawBase && /^https?:\/\//i.test(rawBase)) return rawBase;
  const basePath = rawBase && rawBase !== '' ? rawBase : '/api';
  const normalized = basePath.startsWith('/') ? basePath : `/${basePath}`;
  const url = `${window.location.origin}${normalized}`;
  console.log('API_BASE_URL:', url);
  return url;
})();

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export const setToken = (token: string | null) => {
  authToken = token;
};

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler;
};

type RequestOptions = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, base);
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
    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }

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

export const patch = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'PATCH', body });

export const postForm = async <T>(path: string, formData: FormData): Promise<T> => {
  const url = buildUrl(path);
  const finalHeaders: Record<string, string> = {};

  if (authToken) {
    finalHeaders.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: finalHeaders,
    body: formData,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const message = isJson && payload && typeof payload === 'object' && 'message' in (payload as any)
      ? String((payload as any).message)
      : response.statusText || 'Upload failed';
    throw new HttpError(response.status, message, payload);
  }

  return payload as T;
};

export const del = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'DELETE', body });

export { HttpError };
