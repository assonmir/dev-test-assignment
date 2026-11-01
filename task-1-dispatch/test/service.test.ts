import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignOrder, countAssigned, type Deps } from '../src/service.ts';
import type { Branch, Order } from '../src/types.ts';

const branch = (over: Partial<Branch>): Branch => ({
  id: 'b-1',
  storeId: 's-1',
  name: 'Филиал',
  city: 'Алматы',
  lat: 43.24,
  lon: 76.91,
  active: true,
  pickupPointIds: [],
  dailyLimit: 100,
  ...over,
});

const order = (over: Partial<Order>): Order => ({
  id: 'o-1',
  storeId: 's-1',
  city: 'Алматы',
  lat: 43.25,
  lon: 76.92,
  pickupPointId: null,
  manualBranchId: null,
  createdAt: '2026-11-16T06:00:00Z',
  ...over,
});

const makeDeps = (branches: Branch[], orders: Order[]): Deps => ({
  branches,
  orders,
  assignments: new Map(),
});

test('assignOrder: повторный вызов возвращает то же и не занимает лимит', () => {
  const a = branch({ id: 'b-a', dailyLimit: 1 });
  const b = branch({ id: 'b-b', lat: 43.3, lon: 77.0, dailyLimit: 1 });
  const o1 = order({ id: 'o-1' });
  const deps = makeDeps([a, b], [o1]);

  const first = assignOrder(deps, o1);
  const second = assignOrder(deps, o1);

  assert.deepEqual(second, first);
  assert.equal(countAssigned(deps, 'b-a', '2026-11-16'), 1);
});

test('assignOrder: при заполненном лимите заказ уходит в другой филиал', () => {
  const a = branch({ id: 'b-a', dailyLimit: 1 });
  const b = branch({ id: 'b-b', lat: 43.3, lon: 77.0, dailyLimit: 5 });
  const o1 = order({ id: 'o-1' });
  const o2 = order({ id: 'o-2' });
  const deps = makeDeps([a, b], [o1, o2]);

  assert.equal(assignOrder(deps, o1).branchId, 'b-a');
  assert.equal(assignOrder(deps, o2).branchId, 'b-b');
});

test('assignOrder: лимит считается по суткам Алматы', () => {
  const a = branch({ id: 'b-a', dailyLimit: 1 });
  const b = branch({ id: 'b-b', lat: 43.3, lon: 77.0, dailyLimit: 5 });
  const late = order({ id: 'o-1', createdAt: '2026-11-15T18:50:00Z' }); // 15 ноября по Алматы
  const next = order({ id: 'o-2', createdAt: '2026-11-15T19:30:00Z' }); // 16 ноября по Алматы
  const deps = makeDeps([a, b], [late, next]);

  assert.equal(assignOrder(deps, late).branchId, 'b-a');
  assert.equal(assignOrder(deps, next).branchId, 'b-a');
  assert.equal(countAssigned(deps, 'b-a', '2026-11-15'), 1);
  assert.equal(countAssigned(deps, 'b-a', '2026-11-16'), 1);
});