import type { Server } from "socket.io";
import { z } from "zod";
import { Message, Conversation } from "./models";
import { permitted, type Identity } from "./auth";
import { scheduleReminder } from "./queue";
export const messageInput = z.object({
  content: z.string().trim().min(1).max(5000),
  clientId: z.uuid(),
});
export async function sendMessage(
  identity: Identity,
  id: string,
  input: unknown,
  io: Server,
) {
  const data = messageInput.parse(input);
  if (!(await permitted(identity, id)))
    throw Object.assign(new Error("Conversation not found."), { status: 404 });
  let message;
  try {
    message = await Message.create({
      ...data,
      conversation: id,
      senderId: identity.id,
      senderType: identity.type,
      senderName: identity.name,
    });
  } catch (error: any) {
    if (error.code !== 11000) throw error;
    message = await Message.findOne({
      conversation: id,
      senderId: identity.id,
      clientId: data.clientId,
    });
  }
  if (!message) throw new Error("Message could not be confirmed.");
  const timeField =
    identity.type === "customer" ? "lastCustomerAt" : "lastAgentAt";
  // These monotonic writes are safe to repeat if a prior attempt failed midway.
  await Conversation.updateOne(
    { _id: id },
    { $max: { [timeField]: message.createdAt } },
    { timestamps: false },
  );
  await Conversation.updateOne(
    {
      _id: id,
      $or: [
        { lastMessageAt: { $lt: message.createdAt } },
        { lastMessageAt: null },
      ],
    },
    {
      $set: {
        lastMessage: message.content,
        lastMessageAt: message.createdAt,
        updatedAt: message.createdAt,
        ...(identity.type === "customer" ? { status: "open" } : {}),
      },
    },
    { timestamps: false },
  );
  // A duplicate retry also repairs a scheduling failure after the message was persisted.
  if (identity.type === "customer")
    await scheduleReminder(id, String(message._id));
  io.to(`conversation:${id}`).emit("message", message);
  io.to("staff").emit("inbox:changed");
  return message;
}
