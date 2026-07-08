import { defineConfig } from 'vite';
import { WebSocketServer } from 'ws';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Listen on all addresses, including LAN and public addresses
    allowedHosts: ['ebep.educ-ai.fr'],
    proxy: {
      '/proxy-ilaas': {
        target: 'https://litellm-pp.univ-lehavre.fr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-ilaas/, ''),
      },
      '/proxy-albert': {
        target: 'https://albert.api.etalab.gouv.fr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy-albert/, ''),
      }
    }
  },
  plugins: [
    {
      name: 'websocket-server',
      configureServer(server) {
        const wss = new WebSocketServer({ noServer: true });
        
        server.httpServer.on('upgrade', (request, socket, head) => {
          const url = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
          if (url.pathname === '/ws') {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
            });
          }
        });

        const rooms = new Map(); // sessionCode -> Set of ws clients

        wss.on('connection', (ws) => {
          let currentSession = null;
          let clientRole = null;

          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message);
              
              if (data.type === 'join') {
                currentSession = data.session;
                clientRole = data.role; // 'teacher' or 'student'
                
                if (!rooms.has(currentSession)) {
                  rooms.set(currentSession, new Set());
                }
                rooms.get(currentSession).add(ws);
                console.log(`[WS] Client joined room ${currentSession} as ${clientRole}`);
                
                // If student joins, request state sync from teacher
                if (clientRole === 'student') {
                  const clients = rooms.get(currentSession);
                  clients.forEach(client => {
                    if (client !== ws && client.readyState === 1) {
                      client.send(JSON.stringify({ type: 'request-sync' }));
                    }
                  });
                }
              } else if (
                data.type === 'sync-desktop' || 
                data.type === 'sync-background' || 
                data.type === 'sync-transcript' || 
                data.type === 'sync-document' ||
                data.type === 'sync-playlist'
              ) {
                if (currentSession && rooms.has(currentSession)) {
                  rooms.get(currentSession).forEach((client) => {
                    if (client !== ws && client.readyState === 1) {
                      client.send(JSON.stringify(data));
                    }
                  });
                }
              }
            } catch (err) {
              console.error('[WS] Error processing message:', err);
            }
          });

          ws.on('close', () => {
            if (currentSession && rooms.has(currentSession)) {
              rooms.get(currentSession).delete(ws);
              if (rooms.get(currentSession).size === 0) {
                rooms.delete(currentSession);
              }
              console.log(`[WS] Client left room ${currentSession}`);
            }
          });
        });
      }
    }
  ]
});

