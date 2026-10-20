import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { Worker } from "bullmq";
import { config } from "./config";
import { connection, reminders } from "./queue";
import { Conversation, Message, Notification } from "./models";
import { needsReminder } from "./reminder-policy";
await mongoose.connect(config.mongo);
await Notification.init();
const mail = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "127.0.0.1",
  port: Number(process.env.SMTP_PORT || 1025),
  secure: process.env.SMTP_SECURE === "true",
  ...(process.env.SMTP_USER
    ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
    : {}),
});
const worker = new Worker(
  "unanswered",
  async (job) => {
    const { conversation: id, message: messageId } = job.data;
    const [conversation, message] = await Promise.all([
      Conversation.findById(id),
      Message.findById(messageId),
    ]);
    if (!message || !needsReminder(conversation, message.createdAt)) return;
    const key = `reminder-${messageId}`;
    const existing = await Notification.findOne({ key });
    if (existing?.state === "sent") return;
    await Notification.updateOne(
      { key },
      { $set: { state: "sending" } },
      { upsert: true },
    );
    // SMTP does not guarantee exactly-once delivery after a process crash; a stable
    // Message-ID lets mail infrastructure deduplicate where supported.
    try {
      await mail.sendMail({
        from: process.env.MAIL_FROM || "SupportDesk <support@localhost>",
        to: process.env.TEAM_EMAIL || "team@localhost",
        subject: `Waiting for a reply: ${conversation!.subject}`,
        text: `A customer is waiting for a reply.\n\n${message.content}\n\nOpen your SupportDesk inbox to respond.`,
        messageId: `<${key}@supportdesk.local>`,
      });
      await Notification.updateOne(
        { key },
        { $set: { state: "sent", sentAt: new Date() } },
      );
    } catch (error) {
      await Notification.updateOne({ key }, { $set: { state: "failed" } });
      throw error;
    }
  },
  { connection, concurrency: 3 },
);
worker.on("failed", (job, error) =>
  console.error("Reminder failed", job?.id, error.message),
);
async function stop() {
  await worker.close();
  await reminders.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
