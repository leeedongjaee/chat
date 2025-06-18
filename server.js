console.log('서버 시작');

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

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

console.log('서버 스크립트 끝');
