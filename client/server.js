// server.js (Node.js example)
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  const lspProcess = spawn('sql-language-server', ['--stdio']);

  // Forward messages from language server to client
  lspProcess.stdout.on('data', (data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  });

  // Forward messages from client to language server
  ws.on('message', (data) => {
    lspProcess.stdin.write(data);
  });

  // Handle cleanup
  ws.on('close', () => {
    console.log('Client disconnected');
    lspProcess.kill();
  });

  lspProcess.on('error', (error) => {
    console.error('Language server error:', error);
    ws.close();
  });

  lspProcess.on('exit', (code) => {
    console.log('Language server exited with code:', code);
    ws.close();
  });
});

server.listen(3001, () => {
  console.log('LSP WebSocket bridge running on ws://localhost:3001');
});
