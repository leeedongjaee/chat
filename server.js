const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);

// noServer: true 옵션 사용해서 직접 업그레이드 처리
const wss = new WebSocket.Server({ noServer: true });

app.use(express.static(path.join(__dirname, 'public')));

const users = new Map();

function broadcastUserList() {
  const nicknames = [...users.values()];
  const message = JSON.stringify({ type: 'userList', users: nicknames });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// WebSocket 연결 업그레이드 요청 처리
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws) => {
  console.log('New client connected');

  ws.on('message', (data) => {
    let parsed;

    try {
      parsed = JSON.parse(data);
    } catch {
      return;
    }

    if (parsed.type === 'join') {
      users.set(ws, parsed.nickname);
      broadcastUserList();
    } else if (parsed.type === 'message') {
      const messageToSend = `${users.get(ws)}: ${parsed.message}`;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageToSend);
        }
      });
    }
  });

  ws.on('close', () => {
    users.delete(ws);
    broadcastUserList();
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
