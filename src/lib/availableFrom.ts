const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function defaultAvailableFromDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toDateInputValue(value: string): string {
  const trimmed = value.trim();
  if (ISO_DATE.test(trimmed)) return trimmed;
  return "";
}

export function formatAvailableFromDisplay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (ISO_DATE.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat("ro-RO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(parsed);
    }
  }

  return trimmed;
}

export function normalizeAvailableFrom(value: string, fallback?: string): string {
  const trimmed = value.trim();
  if (ISO_DATE.test(trimmed)) return trimmed;
  const fromFallback = fallback ? toDateInputValue(fallback) : "";
  return fromFallback || defaultAvailableFromDate();
}
