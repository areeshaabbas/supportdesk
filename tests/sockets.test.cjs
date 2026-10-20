process.env.JWT_SECRET = "test-secret-for-supportdesk-at-least-32-characters";
jest.mock("../server/queue", () => ({
  scheduleReminder: jest.fn().mockResolvedValue(undefined),
}));
const http = require("node:http");
const { Server } = require("socket.io");
const { io: client } = require("socket.io-client");
const { attachRealtime } = require("../server/sockets");
const { issue } = require("../server/auth");
const { Conversation, Message } = require("../server/models");
const conversationId = "507f1f77bcf86cd799439013";
const identity = {
  id: "507f1f77bcf86cd799439012",
  type: "customer",
  name: "Maya",
  conversationId,
};
let httpServer,
  io,
  url,
  clients = [];
beforeAll(async () => {
  httpServer = http.createServer();
  io = new Server(httpServer);
  attachRealtime(io);
  await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${httpServer.address().port}`;
});
afterEach(() => {
  clients.forEach((c) => c.disconnect());
  clients = [];
  jest.restoreAllMocks();
});
afterAll(async () => {
  await new Promise((resolve) => io.close(resolve));
});
function connect(token) {
  const c = client(url, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
  });
  clients.push(c);
  return c;
}
const event = (c, name) => new Promise((resolve) => c.once(name, resolve));
const emit = (c, name, data) =>
  new Promise((resolve, reject) =>
    c
      .timeout(3000)
      .emit(name, data, (err, value) => (err ? reject(err) : resolve(value))),
  );
test("unauthorized connections are rejected", async () => {
  const c = connect("invalid-token");
  expect((await event(c, "connect_error")).message).toBe("Unauthorized");
});
test("a customer cannot join an unauthorized room", async () => {
  jest.spyOn(Conversation, "findOne").mockResolvedValue(null);
  const c = connect(issue(identity));
  await event(c, "connect");
  const result = await emit(c, "join", "507f1f77bcf86cd799439014");
  expect(result.error).toBeTruthy();
});
test("persisted messages are delivered and duplicate retries are acknowledged with the same id", async () => {
  jest
    .spyOn(Conversation, "findOne")
    .mockResolvedValue({ _id: conversationId });
  jest.spyOn(Conversation, "updateOne").mockResolvedValue({});
  const stored = {
    _id: "507f1f77bcf86cd799439015",
    conversation: conversationId,
    content: "Hello",
    clientId: "ffab96af-7f38-4361-b786-36dcf6912769",
    createdAt: new Date(),
  };
  jest
    .spyOn(Message, "create")
    .mockResolvedValueOnce(stored)
    .mockRejectedValue({ code: 11000 });
  jest.spyOn(Message, "findOne").mockResolvedValue(stored);
  const c = connect(issue(identity));
  await event(c, "connect");
  expect(await emit(c, "join", conversationId)).toEqual({ ok: true });
  const delivery = event(c, "message");
  const first = await emit(c, "message:send", { ...stored, conversationId });
  expect((await delivery)._id).toBe(stored._id);
  const retry = await emit(c, "message:send", { ...stored, conversationId });
  expect(retry.message._id).toBe(first.message._id);
});
test("a reconnected customer can reauthenticate and rejoin the same authorized room", async () => {
  jest
    .spyOn(Conversation, "findOne")
    .mockResolvedValue({ _id: conversationId });
  const token = issue(identity);
  const first = connect(token);
  await event(first, "connect");
  expect(await emit(first, "join", conversationId)).toEqual({ ok: true });
  first.disconnect();
  const second = connect(token);
  await event(second, "connect");
  expect(await emit(second, "join", conversationId)).toEqual({ ok: true });
});
