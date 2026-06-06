/** Maps API / network failures to short Romanian copy for the UI. */

export class ApiError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ParsedApiError = {
  message?: string;
  code?: string;
};

function readNestedMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === "string" ? item : readNestedMessage(item)))
      .filter(Boolean) as string[];
    if (parts.length) return parts.join("; ");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      readNestedMessage(record.message) ??
      readNestedMessage(record.error) ??
      readNestedMessage(record.errors)
    );
  }
  return undefined;
}

export function parseApiErrorBody(body: unknown): ParsedApiError {
  if (!body || typeof body !== "object") {
    return {};
  }

  const record = body as Record<string, unknown>;

  if (record.error && typeof record.error === "object") {
    const nested = record.error as Record<string, unknown>;
    return {
      message: readNestedMessage(nested.message) ?? readNestedMessage(nested),
      code: typeof nested.code === "string" ? nested.code : undefined,
    };
  }

  return {
    message: readNestedMessage(record.message) ?? readNestedMessage(record),
    code: typeof record.code === "string" ? record.code : undefined,
  };
}

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Trebuie să fii conectat. Intră din nou în cont.",
  VALIDATION_ERROR: "Verifică datele introduse și încearcă din nou.",
  NOT_FOUND: "Nu am găsit informația cerută.",
  GEO_SEARCH_FAILED: "Căutarea localității nu a mers acum. Poți scrie localitatea manual.",
  INTERNAL_SERVER_ERROR: "Ceva nu a mers pe server. Încearcă din nou peste câteva secunde.",
  BAD_REQUEST: "Cererea nu a putut fi procesată. Verifică datele și încearcă din nou.",
};

const STATUS_MESSAGES: Record<number, string> = {
  400: "Date invalide. Verifică ce ai completat.",
  401: "Email sau parolă greșită.",
  403: "Nu ai acces la această acțiune.",
  404: "Nu am găsit resursa cerută.",
  422: "Verifică câmpurile marcate și încearcă din nou.",
  429: "Prea multe încercări. Așteaptă puțin și încearcă din nou.",
  500: "Serverul are o problemă temporară. Încearcă din nou.",
  502: "Serviciul extern nu răspunde. Încearcă mai târziu.",
  503: "Serverul este ocupat. Încearcă din nou peste câteva secunde.",
};

const AUTH_MESSAGE_MAP: Record<string, string> = {
  "invalid email or password": "Email sau parolă greșită.",
  "invalid credentials": "Email sau parolă greșită.",
  "user already exists": "Există deja un cont cu acest email.",
  "email already exists": "Există deja un cont cu acest email.",
  "password too short": "Parola este prea scurtă. Folosește cel puțin 8 caractere.",
  "invalid email": "Adresa de email nu pare validă.",
};

const TECHNICAL_PATTERNS = [
  /^failed to fetch$/i,
  /^networkerror/i,
  /^load failed$/i,
  /^request failed \(\d+\)$/i,
  /^body\s*:/i,
  /^\[object object\]$/i,
  /^typeerror:/i,
  /^syntaxerror:/i,
];

function isTechnicalMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return true;
  return TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function mapKnownPhrase(message: string): string | undefined {
  const key = message.trim().toLowerCase();
  if (AUTH_MESSAGE_MAP[key]) return AUTH_MESSAGE_MAP[key];

  for (const [phrase, friendly] of Object.entries(AUTH_MESSAGE_MAP)) {
    if (key.includes(phrase)) return friendly;
  }

  return undefined;
}

export function messageFromApiResponse(body: unknown, status: number): string {
  const parsed = parseApiErrorBody(body);

  if (parsed.code && CODE_MESSAGES[parsed.code]) {
    return CODE_MESSAGES[parsed.code];
  }

  if (parsed.message) {
    const mapped = mapKnownPhrase(parsed.message);
    if (mapped) return mapped;
    if (!isTechnicalMessage(parsed.message)) return parsed.message;
  }

  return STATUS_MESSAGES[status] ?? "Ceva nu a mers. Încearcă din nou.";
}

export function messageFromUnknownError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof TypeError) {
    return "Nu ne putem conecta la server. Verifică dacă rulează backend-ul sau reîncarcă pagina.";
  }

  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return "Căutarea durează mai mult decât de obicei. Încearcă din nou peste câteva momente.";
    }
    const mapped = mapKnownPhrase(error.message);
    if (mapped) return mapped;
    if (!isTechnicalMessage(error.message)) return error.message;
  }

  return fallback;
}

export function messageFromAuthError(error: { message?: string; status?: number; code?: string } | null | undefined): string {
  if (!error) return "Autentificare eșuată. Încearcă din nou.";

  if (error.code && CODE_MESSAGES[error.code]) {
    return CODE_MESSAGES[error.code];
  }

  if (error.message) {
    const mapped = mapKnownPhrase(error.message);
    if (mapped) return mapped;
    if (!isTechnicalMessage(error.message)) return error.message;
  }

  if (error.status && STATUS_MESSAGES[error.status]) {
    return STATUS_MESSAGES[error.status];
  }

  return "Autentificare eșuată. Verifică emailul și parola.";
}
