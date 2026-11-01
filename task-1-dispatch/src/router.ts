import type { Assignment, Branch, Order } from './types.ts';
import { distanceKm } from './geo.ts';

export function assignBranch(
  order: Order,
  branches: Branch[],
  isFull: (branchId: string) => boolean = () => false,
): Assignment {
  const result = pickBranch(order, branches);

  // manual лимит не проверяет, unassigned проверять нечего
  if (result.rule === 'manual' || result.branchId === null) return result;
  if (!isFull(result.branchId)) return result;

  // выбранный филиал заполнен: ближайший незаполненный филиал магазина
  const free = activeBranches(order, branches).filter((b) => !isFull(b.id));
  const nearest = findNearest(order, free);
  if (nearest) return { orderId: order.id, branchId: nearest.id, rule: 'geo' };

  return { orderId: order.id, branchId: null, rule: 'unassigned' };
}

function activeBranches(order: Order, branches: Branch[]): Branch[] {
  return branches.filter((b) => b.storeId === order.storeId && b.active);
}

// выбор филиала по правилам, без учёта лимита
function pickBranch(order: Order, branches: Branch[]): Assignment {
  const own = activeBranches(order, branches);

  if (order.manualBranchId) {
    const manual = own.find((b) => b.id === order.manualBranchId);
    if (manual) return { orderId: order.id, branchId: manual.id, rule: 'manual' };
  }

  if (own.length === 1) {
    return { orderId: order.id, branchId: own[0].id, rule: 'single' };
  }

  const pickupId = order.pickupPointId;
  if (pickupId) {
    const byPickup = own.find((b) => b.pickupPointIds.includes(pickupId));
    if (byPickup) return { orderId: order.id, branchId: byPickup.id, rule: 'pickup_point' };
  }

  const inCity = own.filter((b) => b.city === order.city);
  if (inCity.length === 1) {
    return { orderId: order.id, branchId: inCity[0].id, rule: 'city' };
  }

  const candidates = inCity.length > 1 ? inCity : own;
  const nearest = findNearest(order, candidates);
  if (nearest) return { orderId: order.id, branchId: nearest.id, rule: 'geo' };

  return { orderId: order.id, branchId: null, rule: 'unassigned' };
}

function findNearest(order: Order, branches: Branch[]): Branch | null {
  if (order.lat === null || order.lon === null) return null;

  let best: Branch | null = null;
  let bestDist = Infinity;
  for (const b of branches) {
    const d = distanceKm(order.lat, order.lon, b.lat, b.lon);
    if (d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
}