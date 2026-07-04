import { RATE_LIMIT_MS } from "./constants.js";

export class SemanticScholarApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`Semantic Scholar API error (${status}): ${message}`);
    this.name = "SemanticScholarApiError";
  }
}

class TokenBucketRateLimiter {
  private tokens: number = 1;
  private lastRefill: number = Date.now();

  async acquire(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    if (elapsed >= RATE_LIMIT_MS) {
      this.tokens = 1;
      this.lastRefill = now;
    }

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    const waitMs = RATE_LIMIT_MS - elapsed;
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    this.tokens = 0;
    this.lastRefill = Date.now();
  }
}

export const rateLimiter = new TokenBucketRateLimiter();

type ParamValue = string | number | boolean | undefined | null;

export async function s2Request<T>(options: {
  baseUrl: string;
  path: string;
  method?: "GET" | "POST";
  params?: Record<string, ParamValue>;
  body?: unknown;
}): Promise<T> {
  await rateLimiter.acquire();

  const { baseUrl, path, method = "GET", params, body } = options;

  const url = new URL(`${baseUrl}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    "Accept": "application/json",
  };

  const apiKey = process.env.SEMANTICSCHOLAR_API_KEY;
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  if (method === "POST") {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message: string;
    try {
      const errorData = await response.json() as { message?: string; error?: string };
      message = errorData.message ?? errorData.error ?? response.statusText;
    } catch {
      message = response.statusText;
    }
    throw new SemanticScholarApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}
