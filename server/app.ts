import express from "express";
import path from "node:path";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import type { Server } from "socket.io";
import { config } from "./config";
import { User, Customer, Conversation, Message, ReadMarker } from "./models";
import { auth, staff, admin, issue, permitted } from "./auth";
import { sendMessage } from "./messaging";
const credentials = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1).max(128),
});
const objectId = z.string().regex(/^[a-f\d]{24}$/i);
export function createApp(io: Server) {
  const app = express();
  if (process.env.RENDER === "true") app.set("trust proxy", 1);
  app.use(
    helmet(),
    cors({ origin: config.origin }),
    express.json({ limit: "32kb" }),
  );
  app.get("/api/health", (_req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      database:
        mongoose.connection.readyState === 1 ? "connected" : "unavailable",
    }),
  );
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  });
  app.post("/api/auth/login", limit, async (req, res) => {
    const data = credentials.parse(req.body);
    const user = await User.findOne({ email: data.email, active: true }).select(
      "+password",
    );
    if (!user || !(await bcrypt.compare(data.password, user.password)))
      return void res
        .status(401)
        .json({ error: "Email or password is incorrect." });
    const identity = {
      id: String(user._id),
      type: "staff" as const,
      name: user.name,
      role: user.role,
    };
    res.json({ token: issue(identity), user: identity });
  });
  app.post("/api/auth/demo", limit, async (_req, res) => {
    if (process.env.DEMO_LOGIN_ENABLED !== "true")
      return void res.status(404).json({ error: "Demo access is disabled." });
    const user = await User.findOne({
      email: "demo@supportdesk.local",
      role: "agent",
      active: true,
    });
    if (!user)
      return void res.status(503).json({
        error: "The demo workspace is not ready yet. Please try again shortly.",
      });
    const identity = {
      id: String(user._id),
      type: "staff" as const,
      name: user.name,
      role: "agent",
    };
    res.json({ token: issue(identity), user: identity });
  });
  app.post("/api/widget/sessions", limit, async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.email(),
        subject: z.string().trim().min(1).max(160),
      })
      .parse(req.body);
    const customer = await Customer.create(data);
    const conversation = await Conversation.create({
      customer: customer._id,
      subject: data.subject,
    });
    res.status(201).json({
      token: issue({
        id: String(customer._id),
        type: "customer",
        name: data.name,
        conversationId: String(conversation._id),
      }),
      conversation,
    });
  });
  app.use("/api", auth);
  app.get("/api/auth/me", (req, res) => res.json(req.identity));
  app.get("/api/agents", staff, async (_req, res) =>
    res.json(
      await User.find({ active: true }).select("name email role active"),
    ),
  );
  app.post("/api/agents", admin, async (req, res) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.email().toLowerCase(),
        password: z.string().min(12).max(128),
        role: z.enum(["admin", "agent"]).default("agent"),
      })
      .parse(req.body);
    const user = await User.create({
      ...data,
      password: await bcrypt.hash(data.password, 12),
    });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
    });
    io.to("staff").emit("inbox:changed");
  });
  app.patch("/api/agents/:id", admin, async (req, res) => {
    const id = objectId.parse(req.params.id);
    if (id === req.identity.id)
      return void res
        .status(400)
        .json({ error: "You cannot deactivate your own account." });
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const user = await User.findByIdAndUpdate(id, { active }, { new: true });
    if (!user) return void res.status(404).json({ error: "Agent not found." });
    if (!active) io.in(`user:${id}`).disconnectSockets(true);
    res.json(user);
  });
  app.get("/api/conversations", staff, async (req, res) => {
    const query = z
      .object({
        status: z.enum(["open", "pending", "resolved"]).optional(),
        assigned: z.union([z.literal("unassigned"), objectId]).optional(),
        q: z.string().max(200).optional(),
        before: objectId.optional(),
      })
      .parse(req.query);
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.assigned)
      filter.assignedTo =
        query.assigned === "unassigned" ? null : query.assigned;
    if (query.q) {
      const regex = new RegExp(
        query.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i",
      );
      const customers = await Customer.find({
        $or: [{ name: regex }, { email: regex }],
      })
        .select("_id")
        .limit(200);
      const ids = await Message.find({ $text: { $search: query.q } }).distinct(
        "conversation",
      );
      filter.$or = [
        { subject: regex },
        { customer: { $in: customers.map((c) => c._id) } },
        { _id: { $in: ids } },
      ];
    }
    // Inbox pagination uses the immutable ID order; edits cannot cause skipped rows.
    if (query.before) filter._id = { $lt: query.before };
    const items = await Conversation.find(filter)
      .sort({ _id: -1 })
      .limit(51)
      .populate("customer")
      .populate("assignedTo", "name email");
    const hasMore = items.length > 50;
    if (hasMore) items.pop();
    const counts = await Conversation.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    res.json({
      items,
      hasMore,
      next: hasMore ? items.at(-1)?._id : null,
      counts: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    });
  });
  app.get("/api/conversations/:id", async (req, res) => {
    const id = objectId.parse(req.params.id);
    if (!(await permitted(req.identity, id)))
      return void res.status(404).json({ error: "Conversation not found." });
    res.json(
      await Conversation.findById(id)
        .populate("customer")
        .populate("assignedTo", "name email"),
    );
  });
  app.patch("/api/conversations/:id", staff, async (req, res) => {
    const id = objectId.parse(req.params.id);
    const data = z
      .object({
        status: z.enum(["open", "pending", "resolved"]).optional(),
        assignedTo: objectId.nullable().optional(),
      })
      .refine((v) => Object.keys(v).length > 0)
      .parse(req.body);
    if (
      data.assignedTo &&
      !(await User.exists({ _id: data.assignedTo, active: true }))
    )
      return void res.status(400).json({ error: "Choose an active agent." });
    const result = await Conversation.findByIdAndUpdate(id, data, { new: true })
      .populate("customer")
      .populate("assignedTo", "name email");
    if (!result)
      return void res.status(404).json({ error: "Conversation not found." });
    io.to("staff").emit("inbox:changed");
    io.to(`conversation:${id}`).emit("conversation:changed", result);
    res.json(result);
  });
  app.get("/api/conversations/:id/messages", async (req, res) => {
    const id = objectId.parse(req.params.id);
    if (!(await permitted(req.identity, id)))
      return void res.status(404).json({ error: "Conversation not found." });
    const { before, after } = z
      .object({ before: objectId.optional(), after: objectId.optional() })
      .refine((v) => !(v.before && v.after))
      .parse(req.query);
    const filter: any = { conversation: id };
    if (before) filter._id = { $lt: before };
    if (after) filter._id = { $gt: after };
    const rows = await Message.find(filter)
      .sort({ _id: after ? 1 : -1 })
      .limit(51);
    const hasMore = rows.length > 50;
    if (hasMore) rows.pop();
    if (!after) rows.reverse();
    res.json({ items: rows, hasMore });
  });
  app.post("/api/conversations/:id/messages", async (req, res) =>
    res
      .status(201)
      .json(
        await sendMessage(
          req.identity,
          objectId.parse(req.params.id),
          req.body,
          io,
        ),
      ),
  );
  app.post("/api/conversations/:id/read", async (req, res) => {
    const id = objectId.parse(req.params.id);
    if (!(await permitted(req.identity, id)))
      return void res.status(404).json({ error: "Conversation not found." });
    const { messageId } = z.object({ messageId: objectId }).parse(req.body);
    if (!(await Message.exists({ _id: messageId, conversation: id })))
      return void res
        .status(400)
        .json({ error: "Message does not belong to this conversation." });
    await ReadMarker.updateOne(
      { conversation: id, participant: req.identity.id },
      { $max: { messageId: new mongoose.Types.ObjectId(messageId) } },
      { upsert: true },
    );
    io.to(`conversation:${id}`).emit("read", {
      participant: req.identity.id,
      type: req.identity.type,
      messageId,
    });
    res.sendStatus(204);
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  if (process.env.SERVE_FRONTEND === "true") {
    const directory = path.resolve(process.cwd(), "dist");
    app.get("/widget", (_req, res) => {
      // Only the public customer widget is embeddable; staff pages retain Helmet's protection.
      res.removeHeader("X-Frame-Options");
      const policy = String(res.getHeader("Content-Security-Policy") || "");
      res.setHeader(
        "Content-Security-Policy",
        policy.replace(/frame-ancestors[^;]*(;|$)/, ""),
      );
      res.sendFile(path.join(directory, "index.html"));
    });
    app.use(express.static(directory));
  }
  app.use(
    (
      error: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      if (error instanceof z.ZodError)
        return void res.status(400).json({
          error: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
      if (error.code === 11000)
        return void res
          .status(409)
          .json({ error: "This record already exists." });
      console.error(error);
      res.status(error.status || 500).json({
        error: error.status
          ? error.message
          : "Something went wrong. Please try again.",
      });
    },
  );
  return app;
}
