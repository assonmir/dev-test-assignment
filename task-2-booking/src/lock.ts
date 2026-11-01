// Очередь по ключу: задачи с одним ключом выполняются строго по одной
const tails = new Map<string, Promise<void>>();

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = prev.then(() => current);
  tails.set(key, tail);

  await prev; // ждём, пока закончит предыдущая задача
  try {
    return await fn();
  } finally {
    release(); // пускаем следующую
    if (tails.get(key) === tail) tails.delete(key);
  }
}