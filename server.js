const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);

// WebSocket 서버는 noServer 모드로 생성 (upgrade 이벤트 직접 처리)
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
      const nickname = users.get(ws) || '익명';
      const messageToSend = `${nickname}: ${parsed.message}`;
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

  // 혹시 에러 핸들링 추가 (선택)
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
