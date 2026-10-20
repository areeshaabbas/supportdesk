import mongoose, { Schema } from "mongoose";
const options = { timestamps: true } as const;
const userSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "agent"], default: "agent" },
    active: { type: Boolean, default: true },
  },
  options,
);
const customerSchema = new Schema(
  { name: String, email: { type: String, lowercase: true } },
  options,
);
const conversationSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    subject: { type: String, required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: {
      type: String,
      enum: ["open", "pending", "resolved"],
      default: "open",
    },
    lastMessage: String,
    lastMessageAt: Date,
    lastCustomerAt: Date,
    lastAgentAt: Date,
  },
  options,
);
conversationSchema.index({ status: 1, updatedAt: -1 });
conversationSchema.index({ assignedTo: 1, updatedAt: -1 });
const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    senderId: { type: String, required: true },
    senderType: { type: String, enum: ["staff", "customer"], required: true },
    senderName: String,
    content: { type: String, required: true },
    clientId: { type: String, required: true },
  },
  options,
);
messageSchema.index(
  { conversation: 1, senderId: 1, clientId: 1 },
  { unique: true },
);
messageSchema.index({ conversation: 1, _id: 1 });
messageSchema.index({ content: "text" });
const readSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, required: true },
    participant: { type: String, required: true },
    messageId: { type: Schema.Types.ObjectId, required: true },
  },
  options,
);
readSchema.index({ conversation: 1, participant: 1 }, { unique: true });
const notificationSchema = new Schema(
  {
    key: { type: String, unique: true },
    state: { type: String, enum: ["sending", "sent", "failed"] },
    sentAt: Date,
  },
  options,
);
export const User = mongoose.model("User", userSchema);
export const Customer = mongoose.model("Customer", customerSchema);
export const Conversation = mongoose.model("Conversation", conversationSchema);
export const Message = mongoose.model("Message", messageSchema);
export const ReadMarker = mongoose.model("ReadMarker", readSchema);
export const Notification = mongoose.model("Notification", notificationSchema);
