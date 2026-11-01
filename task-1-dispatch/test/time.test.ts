import { test } from 'node:test';
import assert from 'node:assert/strict';
import { almatyDate, isValidDate } from '../src/time.ts';

test('almatyDate: 19:30 UTC уже следующие сутки по Алматы', () => {
  assert.equal(almatyDate('2026-11-15T19:30:00Z'), '2026-11-16');
});

test('almatyDate: 18:50 UTC ещё те же сутки', () => {
  assert.equal(almatyDate('2026-11-15T18:50:00Z'), '2026-11-15');
});

test('almatyDate: учитывает смещение в самой строке', () => {
  assert.equal(almatyDate('2026-11-16T00:30:00+05:00'), '2026-11-16');
});

test('isValidDate: принимает корректную дату', () => {
  assert.equal(isValidDate('2026-11-16'), true);
});

test('isValidDate: отклоняет несуществующую и кривую дату', () => {
  assert.equal(isValidDate('2026-02-30'), false);
  assert.equal(isValidDate('16.11.2026'), false);
  assert.equal(isValidDate('abc'), false);
});