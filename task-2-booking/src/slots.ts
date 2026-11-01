import type { Booking, Master, Service } from './types.ts';
import { fromMinutes, overlaps, toMinutes, TZ_OFFSET, weekday } from './time.ts';
import { now } from './clock.ts';

export const SLOT_STEP_MIN = 15;

const MINUTE_MS = 60_000;

// 'HH:mm' местного времени (Алматы) на дату -> момент времени в мс
function localToMs(date: string, hhmm: string): number {
  return Date.parse(`${date}T${hhmm}:00${TZ_OFFSET}`);
}

// Свободные слоты мастера на дату, 'HH:mm' по Алматы
export function getSlots(master: Master, service: Service, date: string, bookings: Booking[]): string[] {
  const day = master.schedule[weekday(date)];
  if (!day) return [];

  const breaks = day.breaks.map((br) => ({
    start: localToMs(date, br.from),
    end: localToMs(date, br.to),
  }));
  const busy = bookings
    .filter((b) => b.masterId === master.id && b.status === 'active')
    .map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
  const blocked = [...breaks, ...busy];
  const nowMs = now().getTime();

  const result: string[] = [];
  const end = toMinutes(day.to);
  for (let t = toMinutes(day.from); t + service.durationMin <= end; t += SLOT_STEP_MIN) {
    const start = localToMs(date, fromMinutes(t));
    const slot = { start, end: start + service.durationMin * MINUTE_MS };

    if (slot.start <= nowMs) continue; // уже прошло или начинается прямо сейчас
    if (blocked.some((range) => overlaps(slot, range))) continue;

    result.push(fromMinutes(t));
  }
  return result;
}