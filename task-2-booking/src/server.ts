import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { masters, services } from './store.ts';
import { ApiError, cancelBooking, createBooking, listSlots } from './service.ts';

const port = Number(process.env.PORT ?? 3002);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  try {
    if (req.method === 'GET' && url.pathname === '/masters') {
      return send(res, 200, masters);
    }

    if (req.method === 'GET' && url.pathname === '/services') {
      return send(res, 200, services);
    }

    if (req.method === 'GET' && parts[0] === 'masters' && parts[2] === 'slots' && parts.length === 3) {
      const result = await listSlots(
        parts[1],
        url.searchParams.get('serviceId'),
        url.searchParams.get('date'),
      );
      return send(res, 200, result);
    }

    if (req.method === 'POST' && url.pathname === '/bookings') {
      let body: unknown;
      try {
        body = await readJson(req);
      } catch {
        throw new ApiError(400, 'invalid_json');
      }
      return send(res, 201, await createBooking(body));
    }

    if (req.method === 'DELETE' && parts[0] === 'bookings' && parts.length === 2) {
      return send(res, 200, await cancelBooking(parts[1]));
    }

    send(res, 404, { error: 'not_found' });
  } catch (err) {
    if (err instanceof ApiError) return send(res, err.status, { error: err.code });
    console.error(err);
    send(res, 500, { error: 'internal' });
  }
});

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : null;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

server.listen(port, () => {
  console.log(`booking: http://localhost:${port}`);
});