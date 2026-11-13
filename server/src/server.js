import 'dotenv/config';
import http from 'node:http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDatabase } from './config/db.js';
import { attachSockets } from './sockets/index.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

await connectDatabase();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN?.split(',') || 'http://localhost:5173', credentials: true }
});
app.set('io', io);
attachSockets(io);

const port = Number(process.env.PORT || 4000);
server.listen(port, () => console.log(`Vehicle Connect API listening on ${port}.`));
