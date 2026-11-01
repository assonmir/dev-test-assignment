import { createServer, type ServerResponse } from 'node:http';
import { assignments, branches, orders } from './store.ts';
import { assignOrder, countAssigned } from './service.ts';
import { isValidDate } from './time.ts';

const port = Number(process.env.PORT ?? 3001);
const deps = { branches, orders, assignments };

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    if (req.method === 'GET' && url.pathname === '/branches') {
      return send(res, 200, branches);
    }

    if (req.method === 'GET' && parts[0] === 'orders' && parts.length === 2) {
      const order = orders.find((o) => o.id === parts[1]);
      if (!order) return send(res, 404, { error: 'order_not_found' });
      return send(res, 200, order);
    }

    if (req.method === 'POST' && parts[0] === 'orders' && parts[2] === 'assign' && parts.length === 3) {
      const order = orders.find((o) => o.id === parts[1]);
      if (!order) return send(res, 404, { error: 'order_not_found' });
      return send(res, 200, assignOrder(deps, order));
    }

    if (req.method === 'GET' && parts[0] === 'branches' && parts[2] === 'load' && parts.length === 3) {
      const date = url.searchParams.get('date');
      if (!date || !isValidDate(date)) return send(res, 400, { error: 'invalid_date' });
      const branch = branches.find((b) => b.id === parts[1]);
      if (!branch) return send(res, 404, { error: 'branch_not_found' });
      return send(res, 200, {
        branchId: branch.id,
        date,
        assigned: countAssigned(deps, branch.id, date),
        limit: branch.dailyLimit,
      });
    }

    send(res, 404, { error: 'not_found' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'internal' });
  }
});

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

server.listen(port, () => {
  console.log(`dispatch: http://localhost:${port}`);
});