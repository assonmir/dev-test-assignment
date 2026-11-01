const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

// ISO (UTC) -> дата по Алматы в формате YYYY-MM-DD
export function almatyDate(iso: string): string {
  return new Date(new Date(iso).getTime() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
}

// строго YYYY-MM-DD и реальная дата (2026-02-30 не проходит)
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}