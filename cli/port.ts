import net from 'node:net';

/** First free port in `[start, end]` — `dev` starts Expo web "on the first free port from 5181"
 *  (design §2) instead of failing when that exact port is already in use. */
export function findFreePort(start: number, end: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number) => {
      if (port > end) {
        reject(new Error(`No free port found between ${start} and ${end}.`));
        return;
      }
      const tester = net.createServer();
      tester.once('error', () => {
        tester.close(() => tryPort(port + 1));
      });
      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });
      tester.listen(port, 'localhost');
    };
    tryPort(start);
  });
}
