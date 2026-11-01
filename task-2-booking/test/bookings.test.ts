import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, cancelBooking, createBooking, listSlots } from '../src/service.ts';
import { bookingRepo } from '../src/store.ts';

const input = (over: Record<string, unknown> = {}) => ({
  masterId: 'm-1',
  serviceId: 's-cut',
  start: '2030-11-19T15:00:00+05:00',
  clientPhone: '8 (701) 234-56-78',
  ...over,
});

const isApi = (status: number, code: string) => (e: unknown) =>
  e instanceof ApiError && e.status === status && e.code === code;

// Каждый тест берёт свой день, чтобы записи из одного не мешали другому
// 11-18 только чтение, 11-19 создание, 11-20 гонка, 11-21 отмена

test('listSlots: учитывает записи, перерыв и отменённую запись', async () => {
  const res = await listSlots('m-1', 's-cut', '2030-11-18');
  assert.deepEqual(res.slots, [
    '11:00', '11:15', '11:30', '13:00',
    '15:00', '15:15', '15:30', '15:45', '16:00', '16:15', '16:30', '16:45',
    '17:00', '17:15', '17:30', '17:45', '18:00',
  ]);
});

test('listSlots: ошибки параметров и несуществующие объекты', async () => {
  await assert.rejects(listSlots('m-1', null, '2030-11-18'), isApi(400, 'invalid_params'));
  await assert.rejects(listSlots('m-1', 's-cut', null), isApi(400, 'invalid_params'));
  await assert.rejects(listSlots('m-1', 's-cut', '2030-02-30'), isApi(400, 'invalid_params'));
  await assert.rejects(listSlots('m-1', 's-mani', '2030-11-18'), isApi(400, 'service_not_provided'));
  await assert.rejects(listSlots('m-9', 's-cut', '2030-11-18'), isApi(404, 'master_not_found'));
  await assert.rejects(listSlots('m-1', 's-xxx', '2030-11-18'), isApi(404, 'service_not_found'));
});

test('createBooking: создаёт запись, телефон нормализуется, время в UTC', async () => {
  const b = await createBooking(input());
  assert.equal(b.clientPhone, '+77012345678');
  assert.equal(b.start, '2030-11-19T10:00:00.000Z');
  assert.equal(b.end, '2030-11-19T11:00:00.000Z');
  assert.equal(b.status, 'active');
});

test('createBooking: занятое время даёт 409, запись встык разрешена', async () => {
  await createBooking(input({ start: '2030-11-19T16:00:00+05:00' })); // 16:00-17:00
  await assert.rejects(
    createBooking(input({ start: '2030-11-19T16:30:00+05:00' })),
    isApi(409, 'slot_unavailable'),
  );
  const next = await createBooking(input({ start: '2030-11-19T17:00:00+05:00' })); // встык
  assert.equal(next.start, '2030-11-19T12:00:00.000Z');
});

test('createBooking: не слот, перерыв и вне рабочего времени дают 409', async () => {
  await assert.rejects(createBooking(input({ start: '2030-11-19T15:07:00+05:00' })), isApi(409, 'slot_unavailable'));
  await assert.rejects(createBooking(input({ start: '2030-11-19T14:00:00+05:00' })), isApi(409, 'slot_unavailable'));
  await assert.rejects(createBooking(input({ start: '2030-11-19T19:00:00+05:00' })), isApi(409, 'slot_unavailable'));
});

test('createBooking: время можно передать в UTC', async () => {
  const b = await createBooking(input({ start: '2030-11-19T06:00:00Z' })); // 11:00 по Алматы
  assert.equal(b.start, '2030-11-19T06:00:00.000Z');
});

test('createBooking: неверный телефон, start без пояса и мусор дают 400', async () => {
  await assert.rejects(createBooking(input({ clientPhone: '123' })), isApi(400, 'invalid_phone'));
  await assert.rejects(createBooking(input({ clientPhone: undefined })), isApi(400, 'invalid_phone'));
  await assert.rejects(createBooking(input({ start: '2030-11-19T15:00:00' })), isApi(400, 'invalid_start'));
  await assert.rejects(createBooking(input({ start: 'завтра' })), isApi(400, 'invalid_start'));
  await assert.rejects(createBooking(input({ masterId: 5 })), isApi(400, 'invalid_body'));
  await assert.rejects(createBooking(null), isApi(400, 'invalid_body'));
});

test('createBooking: при одновременных запросах создаётся одна запись', async () => {
  const start = '2030-11-20T15:00:00+05:00';
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => createBooking(input({ start }))));

  const ok = results.filter((r) => r.status === 'fulfilled');
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  assert.equal(ok.length, 1);
  assert.equal(failed.length, 4);
  for (const r of failed) assert.ok(isApi(409, 'slot_unavailable')(r.reason));

  const all = await bookingRepo.listByMaster('m-1');
  const atTime = all.filter((b) => b.start === '2030-11-20T10:00:00.000Z' && b.status === 'active');
  assert.equal(atTime.length, 1);
});

test('cancelBooking: отменяет, повтор не ошибка, слот освобождается', async () => {
  process.env.NOW = '2030-11-21T00:00:00Z';
  try {
    const b = await createBooking(input({ start: '2030-11-21T15:00:00+05:00' }));
    assert.equal((await cancelBooking(b.id)).status, 'cancelled');
    assert.equal((await cancelBooking(b.id)).status, 'cancelled');
    const { slots } = await listSlots('m-1', 's-cut', '2030-11-21');
    assert.ok(slots.includes('15:00'));
  } finally {
    delete process.env.NOW;
  }
});

test('cancelBooking: меньше чем за 2 часа нельзя, ровно за 2 часа можно', async () => {
  const late = await createBooking(input({ start: '2030-11-21T17:00:00+05:00' })); // 12:00Z
  const edge = await createBooking(input({ start: '2030-11-21T18:00:00+05:00' })); // 13:00Z
  process.env.NOW = '2030-11-21T11:00:00Z';
  try {
    await assert.rejects(cancelBooking(late.id), isApi(409, 'too_late')); // за 1 час
    assert.equal((await cancelBooking(edge.id)).status, 'cancelled'); // ровно за 2 часа
    // повторная отмена уже отменённой записи не ошибка, даже когда близко к началу
    process.env.NOW = '2030-11-21T12:30:00Z';
    assert.equal((await cancelBooking(edge.id)).status, 'cancelled');
  } finally {
    delete process.env.NOW;
  }
});

test('cancelBooking: нет такой записи', async () => {
  await assert.rejects(cancelBooking('bk-нет'), isApi(404, 'booking_not_found'));
});