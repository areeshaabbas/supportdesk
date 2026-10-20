process.env.JWT_SECRET = "test-secret-for-supportdesk-at-least-32-characters";
jest.mock("../server/queue", () => ({
  scheduleReminder: jest.fn().mockResolvedValue(undefined),
}));
const supertest = require("supertest");
const bcrypt = require("bcryptjs");
const { createApp } = require("../server/app");
const { User, Conversation, Message, ReadMarker } = require("../server/models");
const { issue } = require("../server/auth");
const { sendMessage } = require("../server/messaging");
const { needsReminder } = require("../server/reminder-policy");
const io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
const app = supertest(createApp(io));
const staff = {
  id: "507f1f77bcf86cd799439011",
  type: "staff",
  role: "agent",
  name: "Alex",
};
const customer = {
  id: "507f1f77bcf86cd799439012",
  type: "customer",
  name: "Maya",
  conversationId: "507f1f77bcf86cd799439013",
};
afterEach(() => jest.restoreAllMocks());
describe("public recruiter demo", () => {
  const original = process.env.DEMO_LOGIN_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.DEMO_LOGIN_ENABLED;
    else process.env.DEMO_LOGIN_ENABLED = original;
  });
  test("is disabled unless explicitly enabled", async () => {
    delete process.env.DEMO_LOGIN_ENABLED;
    expect((await app.post("/api/auth/demo")).status).toBe(404);
  });
  test("issues agent access without exposing an administrator account", async () => {
    process.env.DEMO_LOGIN_ENABLED = "true";
    const lookup = jest.spyOn(User, "findOne").mockResolvedValue({
      _id: staff.id,
      name: "Recruiter Demo",
      role: "agent",
    });
    const result = await app.post("/api/auth/demo");
    expect(result.status).toBe(200);
    expect(result.body.user.role).toBe("agent");
    expect(result.body.token).toBeTruthy();
    expect(lookup).toHaveBeenCalledWith({
      email: "demo@supportdesk.local",
      role: "agent",
      active: true,
    });
  });
  test("does not grant access before the demo account exists", async () => {
    process.env.DEMO_LOGIN_ENABLED = "true";
    jest.spyOn(User, "findOne").mockResolvedValue(null);
    expect((await app.post("/api/auth/demo")).status).toBe(503);
  });
});
test("protected inbox rejects a missing token", async () => {
  expect((await app.get("/api/conversations")).status).toBe(401);
});
test("combined hosting serves the frontend and permits only the public widget to be framed", async () => {
  const original = process.env.SERVE_FRONTEND;
  process.env.SERVE_FRONTEND = "true";
  const hosted = supertest(createApp(io));
  if (original === undefined) delete process.env.SERVE_FRONTEND;
  else process.env.SERVE_FRONTEND = original;
  const homepage = await hosted.get("/");
  expect(homepage.status).toBe(200);
  expect(homepage.text).toContain("SupportDesk");
  expect(homepage.headers["x-frame-options"]).toBe("SAMEORIGIN");
  const widget = await hosted.get("/widget");
  expect(widget.status).toBe(200);
  expect(widget.headers["x-frame-options"]).toBeUndefined();
  expect(widget.headers["content-security-policy"]).not.toContain(
    "frame-ancestors",
  );
});
test("login checks the password hash and issues a scoped staff token", async () => {
  const hash = await bcrypt.hash("correct-password", 4);
  jest.spyOn(User, "findOne").mockReturnValue({
    select: async () => ({
      _id: staff.id,
      name: "Alex",
      role: "agent",
      password: hash,
    }),
  });
  const bad = await app
    .post("/api/auth/login")
    .send({ email: "alex@example.com", password: "wrong" });
  expect(bad.status).toBe(401);
  const good = await app
    .post("/api/auth/login")
    .send({ email: "alex@example.com", password: "correct-password" });
  expect(good.status).toBe(200);
  expect(good.body.user.type).toBe("staff");
  expect(good.body.token).toBeTruthy();
});
test("customers cannot list all conversations or agents", async () => {
  const token = issue(customer);
  expect(
    (await app.get("/api/conversations").auth(token, { type: "bearer" }))
      .status,
  ).toBe(403);
  expect(
    (await app.get("/api/agents").auth(token, { type: "bearer" })).status,
  ).toBe(403);
});
test("a customer cannot read another customer conversation", async () => {
  const lookup = jest.spyOn(Conversation, "findOne").mockResolvedValue(null);
  const res = await app
    .get("/api/conversations/507f1f77bcf86cd799439014/messages")
    .auth(issue(customer), { type: "bearer" });
  expect(res.status).toBe(404);
  expect(lookup.mock.calls[0][0].customer).toBe(customer.id);
  expect(lookup.mock.calls[0][0]._id).toBe(null);
});
test("agents cannot create staff accounts", async () => {
  jest
    .spyOn(User, "findById")
    .mockResolvedValue({ active: true, name: "Alex", role: "agent" });
  expect(
    (
      await app
        .post("/api/agents")
        .auth(issue(staff), { type: "bearer" })
        .send({})
    ).status,
  ).toBe(403);
});
test("invalid statuses are rejected before a database mutation", async () => {
  jest
    .spyOn(User, "findById")
    .mockResolvedValue({ active: true, name: "Alex", role: "agent" });
  const update = jest.spyOn(Conversation, "findByIdAndUpdate");
  const res = await app
    .patch(`/api/conversations/${customer.conversationId}`)
    .auth(issue(staff), { type: "bearer" })
    .send({ status: "deleted" });
  expect(res.status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});
test("assignment rejects inactive or missing agents", async () => {
  jest
    .spyOn(User, "findById")
    .mockResolvedValue({ active: true, name: "Alex", role: "agent" });
  jest.spyOn(User, "exists").mockResolvedValue(null);
  const res = await app
    .patch(`/api/conversations/${customer.conversationId}`)
    .auth(issue(staff), { type: "bearer" })
    .send({ assignedTo: customer.id });
  expect(res.status).toBe(400);
});
test("assignment writes a valid active teammate and broadcasts the change", async () => {
  jest
    .spyOn(User, "findById")
    .mockResolvedValue({ active: true, name: "Alex", role: "agent" });
  jest.spyOn(User, "exists").mockResolvedValue({ _id: customer.id });
  const result = { _id: customer.conversationId, assignedTo: customer.id };
  const populate2 = { populate: jest.fn().mockResolvedValue(result) };
  const populate1 = { populate: jest.fn().mockReturnValue(populate2) };
  const update = jest
    .spyOn(Conversation, "findByIdAndUpdate")
    .mockReturnValue(populate1);
  const res = await app
    .patch(`/api/conversations/${customer.conversationId}`)
    .auth(issue(staff), { type: "bearer" })
    .send({ assignedTo: customer.id });
  expect(res.status).toBe(200);
  expect(update.mock.calls[0][1]).toEqual({ assignedTo: customer.id });
  expect(io.emit).toHaveBeenCalledWith("conversation:changed", result);
});
test("duplicate sends return the persisted message rather than inserting twice", async () => {
  jest
    .spyOn(Conversation, "findOne")
    .mockResolvedValue({ _id: customer.conversationId });
  const stored = {
    _id: "507f1f77bcf86cd799439015",
    content: "Hello",
    createdAt: new Date(),
    clientId: "ffab96af-7f38-4361-b786-36dcf6912769",
  };
  jest.spyOn(Message, "create").mockRejectedValue({ code: 11000 });
  jest.spyOn(Message, "findOne").mockResolvedValue(stored);
  jest.spyOn(Conversation, "updateOne").mockResolvedValue({});
  expect(
    await sendMessage(
      customer,
      customer.conversationId,
      { content: "Hello", clientId: stored.clientId },
      io,
    ),
  ).toBe(stored);
});
test("a read marker must refer to a message in the same conversation", async () => {
  jest.spyOn(Conversation, "findOne").mockResolvedValue({});
  jest.spyOn(Message, "exists").mockResolvedValue(null);
  const update = jest.spyOn(ReadMarker, "updateOne");
  const res = await app
    .post(`/api/conversations/${customer.conversationId}/read`)
    .auth(issue(customer), { type: "bearer" })
    .send({ messageId: "507f1f77bcf86cd799439015" });
  expect(res.status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});
test("reminders skip answered, resolved, pending and superseded requests", () => {
  const trigger = new Date("2026-10-20T10:00:00Z");
  const open = { status: "open", lastCustomerAt: trigger };
  expect(needsReminder(open, trigger)).toBe(true);
  expect(
    needsReminder(
      { ...open, lastAgentAt: new Date("2026-10-20T10:01:00Z") },
      trigger,
    ),
  ).toBe(false);
  for (const status of ["resolved", "pending"])
    expect(needsReminder({ ...open, status }, trigger)).toBe(false);
  expect(
    needsReminder(
      { ...open, lastCustomerAt: new Date("2026-10-20T10:02:00Z") },
      trigger,
    ),
  ).toBe(false);
  expect(needsReminder(null, trigger)).toBe(false);
});
