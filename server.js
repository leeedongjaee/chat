const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});
const upload = multer({ storage });

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('file'), (req, res) => {
  const { originalname, filename } = req.file;
  const from = req.body.nickname || '익명';

  const fileMessage = JSON.stringify({
    type: 'file',
    from,
    filename,
    originalname,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(fileMessage);
    }
  });

  res.status(200).json({ success: true });
});

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
      const messageToSend = JSON.stringify({
        type: 'message',
        from: nickname,
        message: parsed.message,
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageToSend);
        }
      });
    } else if (parsed.type === 'emoji') {
      const nickname = users.get(ws) || parsed.from || '익명';
      const emojiMessage = JSON.stringify({
        type: 'emoji',
        from: nickname,
        dataUrl: parsed.dataUrl,
      });

      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(emojiMessage);
        }
      });
    }
  });

  ws.on('close', () => {
    users.delete(ws);
    broadcastUserList();
    console.log('Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
