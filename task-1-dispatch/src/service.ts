import { assignBranch } from './router.ts';
import { almatyDate } from './time.ts';
import type { Assignment, Branch, Order } from './types.ts';

export type Deps = {
  branches: Branch[];
  orders: Order[];
  assignments: Map<string, Assignment>;
};

// сколько заказов уже закреплено за филиалом в сутки date (по Алматы)
export function countAssigned(deps: Deps, branchId: string, date: string): number {
  let n = 0;
  for (const a of deps.assignments.values()) {
    if (a.branchId !== branchId) continue;
    const o = deps.orders.find((x) => x.id === a.orderId);
    if (o && almatyDate(o.createdAt) === date) n++;
  }
  return n;
}

export function assignOrder(deps: Deps, order: Order): Assignment {
  // повторный вызов: возвращаем то же и лимит не занимаем второй раз
  const existing = deps.assignments.get(order.id);
  if (existing) return existing;

  const date = almatyDate(order.createdAt);
  const isFull = (branchId: string) => {
    const b = deps.branches.find((x) => x.id === branchId);
    return !b || countAssigned(deps, branchId, date) >= b.dailyLimit;
  };

  const result = assignBranch(order, deps.branches, isFull);
  deps.assignments.set(order.id, result);
  return result;
}