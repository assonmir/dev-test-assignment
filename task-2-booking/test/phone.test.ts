import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from '../src/phone.ts';

test('normalizePhone: принимает разные форматы', () => {
  const inputs = ['+7 701 234 56 78', '87012345678', '8 (701) 234-56-78', '+7(701)2345678', '7 701 234 56 78'];
  for (const raw of inputs) {
    assert.equal(normalizePhone(raw), '+77012345678', raw);
  }
});

test('normalizePhone: отклоняет неподходящие номера', () => {
  const bad = [
    '',
    'abc',
    '+7 701 234 56', // коротко
    '+7 701 234 56 789', // длинно
    '+8 701 234 56 78', // +8 бывает только 7
    '8 (727) 234-56-78', // городской, не мобильный
    '+7 701 234 56 7a', // буква
    '+44 7012 345678', // не Казахстан
  ];
  for (const raw of bad) {
    assert.equal(normalizePhone(raw), null, raw);
  }
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone(87012345678), null);
});