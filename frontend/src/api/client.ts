const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function getToken(): string | null {
  return localStorage.getItem("extraaula_token");
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem("extraaula_token", token);
  } else {
    localStorage.removeItem("extraaula_token");
  }
}

export function getWsUrl(path: string): string {
  const configured = import.meta.env.VITE_WS_URL;
  if (configured) {
    return `${configured.replace(/\/$/, "")}${path}`;
  }
  if (API_BASE) {
    const wsBase = API_BASE.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
    return `${wsBase}${path}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${path}`;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let detail = "Ocorreu um erro na requisição.";
    let code: string | undefined;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") {
        detail = body.detail;
      } else if (Array.isArray(body.detail) && body.detail[0]?.msg) {
        detail = body.detail[0].msg;
      }
      code = body.code;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(detail, res.status, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}
