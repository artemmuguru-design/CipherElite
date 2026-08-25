const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname)));

const rooms = {
    '#1': { players: new Map() },
    '#2': { players: new Map() }
};

let nextId = 1;

wss.on('connection', (ws) => {
    const playerId = nextId++;
    let currentRoom = null;
    let playerPos = { x: 0, y: 0.62, z: 0 };

    ws.send(JSON.stringify({ type: 'yourId', id: playerId }));

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);

            if (data.type === 'join') {
                if (currentRoom) {
                    rooms[currentRoom].players.delete(playerId);
                }
                currentRoom = data.room;
                if (rooms[currentRoom]) {
                    rooms[currentRoom].players.set(playerId, { pos: playerPos, ws: ws });
                    
                    // Отправить новому игроку список всех
                    const players = [];
                    for (const [id, p] of rooms[currentRoom].players) {
                        if (id !== playerId) {
                            players.push({ id, pos: p.pos });
                        }
                    }
                    ws.send(JSON.stringify({ type: 'initPlayers', players }));

                    // Сообщить всем о новом игроке
                    broadcast(currentRoom, {
                        type: 'playerJoined',
                        id: playerId,
                        pos: playerPos
                    }, playerId);
                }
            }

            if (data.type === 'move') {
                playerPos = data.pos;
                if (currentRoom) {
                    broadcast(currentRoom, {
                        type: 'playerMoved',
                        id: playerId,
                        pos: playerPos
                    }, playerId);
                }
            }

            if (data.type === 'jump') {
                if (currentRoom) {
                    broadcast(currentRoom, {
                        type: 'playerJumped',
                        id: playerId
                    }, playerId);
                }
            }

        } catch(e) {}
    });

    ws.on('close', () => {
        if (currentRoom) {
            rooms[currentRoom].players.delete(playerId);
            broadcast(currentRoom, {
                type: 'playerLeft',
                id: playerId
            });
        }
    });
});

function broadcast(roomName, data, excludeId = null) {
    const room = rooms[roomName];
    if (!room) return;
    const msg = JSON.stringify(data);
    for (const [id, p] of room.players) {
        if (id !== excludeId && p.ws.readyState === WebSocket.OPEN) {
            p.ws.send(msg);
        }
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер на порту ${PORT}`));
