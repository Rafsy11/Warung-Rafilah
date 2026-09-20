import net from 'net';

let proxyStarted = false;
let proxyServer: net.Server | null = null;

export function ensureCupsProxy() {
  if (proxyStarted) return;

  try {
    proxyServer = net.createServer((socket) => {
      const client = net.createConnection({
        host: 'host.docker.internal',
        port: 631
      });
      socket.pipe(client).pipe(socket);

      socket.on('error', () => {});
      client.on('error', () => {});
    });

    proxyServer.on('error', (err: NodeJS.ErrnoException) => {
      // Ignore EADDRINUSE if another import/request already bound the port
      if (err.code === 'EADDRINUSE') {
        proxyStarted = true;
        return;
      }
      console.error('CUPS TCP Proxy server error:', err);
      proxyStarted = false;
    });

    proxyServer.listen(8631, '127.0.0.1', () => {
      console.log('CUPS TCP Proxy listening on 127.0.0.1:8631 -> host.docker.internal:631');
      proxyStarted = true;
    });
  } catch (caught) {
    const err = caught as NodeJS.ErrnoException;
    if (err.code === 'EADDRINUSE') {
      proxyStarted = true;
    } else {
      console.error('Failed to start CUPS TCP Proxy:', err);
    }
  }
}
