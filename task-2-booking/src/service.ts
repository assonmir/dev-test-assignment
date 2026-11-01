import { randomUUID } from 'node:crypto';
import { now } from './clock.ts';
import { withLock } from './lock.ts';
import { normalizePhone } from './phone.ts';
import { getSlots } from './slots.ts';
import { bookingRepo, masters, services } from './store.ts';
import { isValidDate, toLocal } from './time.ts';
import type { Booking, Master, Service } from './types.ts';

const MINUTE_MS = 60_000;
const MIN_CANCEL_MS = 2 * 60 * MINUTE_MS;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function resolve(masterId: string, serviceId: string): { master: Master; service: Service } {
  const master = masters.find((m) => m.id === masterId);
  const service = services.find((s) => s.id === serviceId);
  if (!master) throw new ApiError(404, 'master_not_found');
  if (!service) throw new ApiError(404, 'service_not_found');
  if (!service.masterIds.includes(master.id)) throw new ApiError(400, 'service_not_provided');
  return { master, service };
}

// ISO-строка обязательно с часовым поясом (Z или +05:00)
const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function parseStart(raw: unknown): number | null {
  if (typeof raw !== 'string' || !ISO_WITH_TZ.test(raw)) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

export async function listSlots(masterId: string, serviceId: string | null, date: string | null) {
  if (!serviceId || !date || !isValidDate(date)) throw new ApiError(400, 'invalid_params');
  const { master, service } = resolve(masterId, serviceId);
  const bookings = await bookingRepo.listByMaster(master.id);
  return {
    masterId: master.id,
    serviceId: service.id,
    date,
    slots: getSlots(master, service, date, bookings),
  };
}

export async function createBooking(body: unknown): Promise<Booking> {
  if (typeof body !== 'object' || body === null) throw new ApiError(400, 'invalid_body');
  const { masterId, serviceId, start, clientPhone } = body as Record<string, unknown>;
  if (typeof masterId !== 'string' || typeof serviceId !== 'string') {
    throw new ApiError(400, 'invalid_body');
  }

  const phone = normalizePhone(clientPhone);
  if (!phone) throw new ApiError(400, 'invalid_phone');

  const startMs = parseStart(start);
  if (startMs === null) throw new ApiError(400, 'invalid_start');

  const { master, service } = resolve(masterId, serviceId);

  // проверка слота и запись должны идти как одно целое, поэтому блокировка по мастеру
  return withLock(`master:${master.id}`, async () => {
    const bookings = await bookingRepo.listByMaster(master.id);
    const { date, time } = toLocal(startMs);
    const free = startMs % MINUTE_MS === 0 && getSlots(master, service, date, bookings).includes(time);
    if (!free) throw new ApiError(409, 'slot_unavailable');

    const booking: Booking = {
      id: `bk-${randomUUID()}`,
      masterId: master.id,
      serviceId: service.id,
      start: new Date(startMs).toISOString(),
      end: new Date(startMs + service.durationMin * MINUTE_MS).toISOString(),
      clientPhone: phone,
      status: 'active',
    };
    await bookingRepo.insert(booking);
    return booking;
  });
}

export async function cancelBooking(id: string): Promise<Booking> {
  const booking = await bookingRepo.get(id);
  if (!booking) throw new ApiError(404, 'booking_not_found');

  // повторная отмена не ошибка (даже если до записи меньше 2 часов)
  if (booking.status === 'cancelled') return booking;

  if (Date.parse(booking.start) - now().getTime() < MIN_CANCEL_MS) {
    throw new ApiError(409, 'too_late');
  }

  await bookingRepo.update(id, { status: 'cancelled' });
  return { ...booking, status: 'cancelled' };
}