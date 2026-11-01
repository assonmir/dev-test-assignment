import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignBranch } from '../src/router.ts';
import { distanceKm } from '../src/geo.ts';
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

const almaty = branch({ id: 'b-ala', city: 'Алматы', lat: 43.2567, lon: 76.9286 });
const astana = branch({ id: 'b-ast', city: 'Астана', lat: 51.128, lon: 71.43 });

test('distanceKm: Алматы — Астана около 970 км', () => {
  const d = distanceKm(43.2389, 76.8897, 51.1694, 71.4491);
  assert.ok(Math.abs(d - 970) < 15, `получили ${d.toFixed(1)}`);
});

test('manual: заказ уходит в указанный филиал', () => {
  const res = assignBranch(order({ manualBranchId: 'b-ast' }), [almaty, astana]);
  assert.deepEqual(res, { orderId: 'o-1', branchId: 'b-ast', rule: 'manual' });
});

test('manual: неактивный филиал пропускается', () => {
  const closed = { ...astana, active: false };
  const res = assignBranch(order({ manualBranchId: 'b-ast' }), [almaty, closed]);
  assert.notEqual(res.rule, 'manual');
});

test('single: у магазина один активный филиал', () => {
  const res = assignBranch(order({ city: 'Шымкент' }), [almaty]);
  assert.deepEqual(res, { orderId: 'o-1', branchId: 'b-ala', rule: 'single' });
});

test('geo: выбирается ближайший филиал', () => {
  const res = assignBranch(order({ city: 'Конаев', lat: 43.25, lon: 76.93 }), [almaty, astana]);
  assert.deepEqual(res, { orderId: 'o-1', branchId: 'b-ala', rule: 'geo' });
});

test('geo: без координат заказ не распределяется', () => {
  const res = assignBranch(order({ city: 'Конаев', lat: null, lon: null }), [almaty, astana]);
  assert.equal(res.rule, 'unassigned');
});

test('pickup_point: пункт выдачи закреплён за филиалом', () => {
  const far = branch({ id: 'b-far', lat: 43.5, lon: 77.3, pickupPointIds: ['pp-1'] });
  const near = branch({ id: 'b-near' });
  const res = assignBranch(order({ pickupPointId: 'pp-1' }), [near, far]);
  assert.deepEqual(res, { orderId: 'o-1', branchId: 'b-far', rule: 'pickup_point' });
});

test('city: в городе заказа один филиал магазина', () => {
  const shymkent = branch({ id: 'b-shy', city: 'Шымкент', lat: 42.34, lon: 69.59 });
  const res = assignBranch(order({ city: 'Шымкент' }), [almaty, shymkent]);
  assert.deepEqual(res, { orderId: 'o-1', branchId: 'b-shy', rule: 'city' });
});

test('geo: если в городе несколько филиалов, выбирается ближайший из них', () => {
  const west = branch({ id: 'b-ala-2', city: 'Алматы', lat: 43.265, lon: 76.835 });
  const res = assignBranch(order({ city: 'Алматы', lat: 51.1, lon: 71.4 }), [almaty, west, astana]);
  assert.deepEqual(res, { orderId: 'o-1', branchId: 'b-ala-2', rule: 'geo' });
});

test.todo('лимит: заполненный филиал пропускается');
