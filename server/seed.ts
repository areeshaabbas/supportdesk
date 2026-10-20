import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "./config";
import { User, Customer, Conversation, Message } from "./models";
import { demoAgents, demoConversations, demoMessages } from "../src/demo";
await mongoose.connect(config.mongo);
await Promise.all([User.init(), Message.init()]);
const email = process.env.SEED_ADMIN_EMAIL || "alex@supportdesk.local";
const password = process.env.SEED_ADMIN_PASSWORD;
if (!password || password.length < 12)
  throw new Error("Set SEED_ADMIN_PASSWORD to at least 12 characters.");
const admin = await User.findOneAndUpdate(
  { email },
  {
    $setOnInsert: {
      name: "Alex Morgan",
      password: await bcrypt.hash(password, 12),
      role: "admin",
    },
  },
  { upsert: true, new: true },
);
if ((await Conversation.countDocuments()) === 0) {
  const agentMap = new Map<string, any>([["a1", admin]]);
  for (const a of demoAgents.slice(1)) {
    const user = await User.findOneAndUpdate(
      { email: a.email },
      {
        $setOnInsert: {
          name: a.name,
          password: await bcrypt.hash(
            crypto.randomUUID() + crypto.randomUUID(),
            12,
          ),
          role: "agent",
        },
      },
      { upsert: true, new: true },
    );
    agentMap.set(a._id, user);
  }
  for (const c of demoConversations) {
    const customer = await Customer.create(c.customer);
    const assigned = c.assignedTo ? agentMap.get(c.assignedTo._id) : null;
    const conversation = await Conversation.create({
      subject: c.subject,
      customer: customer._id,
      assignedTo: assigned?._id || null,
      status: c.status,
      lastMessage: c.lastMessage,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      lastCustomerAt: c.updatedAt,
      lastAgentAt: new Date(new Date(c.createdAt).getTime() + 120000),
    });
    for (const m of demoMessages.filter((m) => m.conversation === c._id)) {
      await Message.create({
        ...m,
        _id: undefined,
        conversation: conversation._id,
        clientId: crypto.randomUUID(),
        senderId:
          m.senderType === "customer"
            ? String(customer._id)
            : String(admin._id),
      });
    }
  }
}
if (process.env.DEMO_LOGIN_ENABLED === "true") {
  await User.findOneAndUpdate(
    { email: "demo@supportdesk.local", role: "agent" },
    {
      $setOnInsert: {
        name: "Recruiter Demo",
        password: await bcrypt.hash(
          crypto.randomUUID() + crypto.randomUUID(),
          12,
        ),
        role: "agent",
        active: true,
      },
    },
    { upsert: true, new: true },
  );
}
console.log(
  `Seed complete. Sign in as ${email} using SEED_ADMIN_PASSWORD. Existing accounts were not overwritten.`,
);
await mongoose.disconnect();
