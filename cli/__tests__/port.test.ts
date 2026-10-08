import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { findFreePort } from '../port.ts';

function occupy(port: number): Promise<net.Server> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, 'localhost', () => resolve(server));
  });
}

function release(server: net.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

/** Binds an OS-assigned ephemeral port to pick this test's own range, instead of hardcoding ports
 *  that could already be in use on a developer's machine. */
function pickBasePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, 'localhost', () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

test('findFreePort returns the start port when it is free', async () => {
  const base = await pickBasePort();
  const port = await findFreePort(base, base + 9);
  assert.ok(port >= base && port <= base + 9);
});

test('findFreePort skips a port that is already listening', async () => {
  const base = await pickBasePort();
  const server = await occupy(base);
  const port = await findFreePort(base, base + 9);
  assert.equal(port, base + 1);
  await release(server);
});

test('findFreePort rejects when the whole range is occupied', async () => {
  const base = await pickBasePort();
  const server = await occupy(base);
  await assert.rejects(() => findFreePort(base, base), new RegExp(`No free port found between ${base} and ${base}`));
  await release(server);
});
