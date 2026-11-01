// Казахстанский мобильный -> '+77012345678', иначе null
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!/^\+?[\d\s()-]+$/.test(s)) return null;

  const digits = s.replace(/\D/g, '');
  if (digits.length !== 11) return null;

  // с плюсом только 7, без плюса допускаем 7 или 8
  const first = digits[0];
  if (s.startsWith('+') ? first !== '7' : first !== '7' && first !== '8') return null;

  // мобильные коды: 70x, 747, 77x
  const national = digits.slice(1);
  if (!/^7(0\d|47|7\d)\d{7}$/.test(national)) return null;

  return `+7${national}`;
}