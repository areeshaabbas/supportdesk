import http from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { config } from "./config";
import { createApp } from "./app";
import { attachRealtime } from "./sockets";
import {
  User,
  Message,
  Conversation,
  ReadMarker,
  Notification,
} from "./models";
import { reminders } from "./queue";
await mongoose.connect(config.mongo);
await Promise.all([
  User.init(),
  Message.init(),
  Conversation.init(),
  ReadMarker.init(),
  Notification.init(),
]);
const io = new Server({ cors: { origin: config.origin } });
const server = http.createServer(createApp(io));
io.attach(server);
attachRealtime(io);
server.listen(config.port, () =>
  console.log(`SupportDesk API http://127.0.0.1:${config.port}`),
);
async function stop() {
  io.close();
  server.close();
  await reminders.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
