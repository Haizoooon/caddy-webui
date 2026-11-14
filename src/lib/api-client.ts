export class ClientApiError extends Error {
  status: number;
  issues?: Record<string, string>;
  warnings?: { file?: string; line?: number; message?: string }[];

  constructor(
    message: string,
    status: number,
    issues?: Record<string, string>,
    warnings?: { file?: string; line?: number; message?: string }[],
  ) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.issues = issues;
    this.warnings = warnings;
  }
}

interface ApiEnvelope {
  ok?: boolean;
  error?: string;
  issues?: Record<string, string>;
  warnings?: { file?: string; line?: number; message?: string }[];
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  let body: (T & ApiEnvelope) | null = null;
  try {
    body = (await response.json()) as T & ApiEnvelope;
  } catch {
    // Non-JSON responses are treated as failures below.
  }

  if (!response.ok || body?.ok === false) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ClientApiError(
      body?.error || `Request failed with HTTP ${response.status}.`,
      response.status,
      body?.issues,
      body?.warnings,
    );
  }

  return body as T;
}

export function fetcher<T>(url: string): Promise<T> {
  return api<T>(url);
}
