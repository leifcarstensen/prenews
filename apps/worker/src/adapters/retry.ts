/**
 * Fetch with exponential backoff and jitter for rate-limited APIs.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: { maxRetries?: number; baseDelay?: number } = {},
): Promise<Response> {
  const maxRetries = config.maxRetries ?? 3;
  const baseDelay = config.baseDelay ?? 1000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);

    // Success or non-retryable error
    if (res.ok || (res.status !== 429 && res.status < 500)) {
      return res;
    }

    // Last attempt — return the error response
    if (attempt === maxRetries) {
      return res;
    }

    // Exponential backoff with jitter
    const delay = baseDelay * Math.pow(2, attempt) + Math.random() * baseDelay;
    console.warn(`[retry] ${res.status} on ${url}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Should not reach here, but satisfy TypeScript
  throw new Error(`fetchWithRetry: exceeded max retries for ${url}`);
}

/**
 * Simple circuit breaker: tracks error rate within a run and aborts
 * if failures exceed a threshold.
 */
export class CircuitBreaker {
  private total = 0;
  private failures = 0;
  private readonly threshold: number;
  private readonly minSampleSize: number;

  constructor(threshold = 0.2, minSampleSize = 10) {
    this.threshold = threshold;
    this.minSampleSize = minSampleSize;
  }

  recordSuccess(): void {
    this.total++;
  }

  recordFailure(): void {
    this.total++;
    this.failures++;
  }

  shouldAbort(): boolean {
    if (this.total < this.minSampleSize) return false;
    return this.failures / this.total > this.threshold;
  }

  get stats() {
    return { total: this.total, failures: this.failures, rate: this.total > 0 ? this.failures / this.total : 0 };
  }
}
