const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;

// ISO (UTC) -> дата по Алматы в формате YYYY-MM-DD
export function almatyDate(iso: string): string {
  return new Date(new Date(iso).getTime() + ALMATY_OFFSET_MS).toISOString().slice(0, 10);
}