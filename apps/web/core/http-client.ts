import { API_CONFIG } from "./config";
import type { ApiResponse, ApiError, RequestOptions } from "./types";

export class ApiException extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiException";
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
  }

  isNetworkError(): boolean {
    return this.status === 0 || this.code === "NETWORK_ERROR";
  }

  isTimeout(): boolean {
    return this.code === "TIMEOUT";
  }

  isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function buildUrl(
  endpoint: string,
  params?: Record<string, string>,
): string {
  const url = new URL(endpoint, API_CONFIG.BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
  }

  return url.toString();
}

export class HttpClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config?: Partial<typeof API_CONFIG>) {
    this.baseUrl = config?.BASE_URL ?? API_CONFIG.BASE_URL;
    this.defaultHeaders = config?.DEFAULT_HEADERS ?? API_CONFIG.DEFAULT_HEADERS;
    this.timeout = config?.TIMEOUT ?? API_CONFIG.TIMEOUT;
    this.retryAttempts = config?.RETRY_ATTEMPTS ?? API_CONFIG.RETRY_ATTEMPTS;
    this.retryDelay = config?.RETRY_DELAY ?? API_CONFIG.RETRY_DELAY;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeout: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...init,
        signal: init.signal || controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async requestWithRetry<T>(
    url: string,
    init: RequestInit,
    options: RequestOptions = {},
  ): Promise<T> {
    const maxRetries = options.retries ?? this.retryAttempts;
    const timeout = options.timeout ?? this.timeout;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, init, timeout);

        // Parse response
        const contentType = response.headers.get("content-type");
        let data: unknown;

        if (contentType?.includes("application/json")) {
          data = await response.json();
        } else if (contentType?.includes("text/")) {
          data = await response.text();
        } else {
          data = await response.blob();
        }

        if (!response.ok) {
          const errorData = data as { message?: string; error?: string };
          throw new ApiException({
            status: response.status,
            message:
              errorData.message ||
              errorData.error ||
              `HTTP Error: ${response.status}`,
            code: `HTTP_${response.status}`,
          });
        }

        return data as T;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof ApiException && error.isClientError()) {
          throw error;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          throw new ApiException({
            status: 0,
            message: "Request timeout",
            code: "TIMEOUT",
          });
        }

        if (error instanceof TypeError) {
          lastError = new ApiException({
            status: 0,
            message: "Network error: Unable to connect to server",
            code: "NETWORK_ERROR",
          });
        }

        if (attempt < maxRetries) {
          await sleep(this.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError;
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, string>,
    options?: RequestOptions,
  ): Promise<T> {
    const url = buildUrl(endpoint, params);
    url.replace(API_CONFIG.BASE_URL, this.baseUrl);

    return this.requestWithRetry<T>(
      url,
      {
        method: "GET",
        headers: this.defaultHeaders,
        credentials: "include",
        signal: options?.signal,
      },
      options,
    );
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const url = buildUrl(endpoint);

    return this.requestWithRetry<T>(
      url,
      {
        method: "POST",
        headers: this.defaultHeaders,
        body: JSON.stringify(body),
        credentials: "include",
        signal: options?.signal,
      },
      options,
    );
  }

  async postFormData<T>(
    endpoint: string,
    formData: FormData,
    options?: RequestOptions,
  ): Promise<T> {
    const url = buildUrl(endpoint);

    const headers = { ...this.defaultHeaders };
    delete (headers as Record<string, string>)["Content-Type"];

    return this.requestWithRetry<T>(
      url,
      {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
        signal: options?.signal,
      },
      options,
    );
  }

  async downloadBlob(
    endpoint: string,
    params?: Record<string, string>,
    options?: RequestOptions,
  ): Promise<Blob> {
    const url = buildUrl(endpoint, params);
    const timeout = options?.timeout ?? this.timeout;

    const response = await this.fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: this.defaultHeaders,
        credentials: "include",
        signal: options?.signal,
      },
      timeout,
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiException({
        status: response.status,
        message:
          (errorData as { message?: string }).message ||
          `Download failed: ${response.status}`,
      });
    }

    return response.blob();
  }
}

export const httpClient = new HttpClient();

export function createHttpClient(
  config: Partial<typeof API_CONFIG>,
): HttpClient {
  return new HttpClient(config);
}
