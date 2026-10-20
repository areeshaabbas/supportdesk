import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import mongoose from "mongoose";
import { config } from "./config";
import { User, Conversation } from "./models";
export type Identity = {
  id: string;
  type: "staff" | "customer";
  name: string;
  role?: string;
  conversationId?: string;
};
declare global {
  namespace Express {
    interface Request {
      identity: Identity;
    }
  }
}
export const issue = (identity: Identity) =>
  jwt.sign(identity, config.secret, {
    expiresIn: identity.type === "staff" ? "12h" : "7d",
    issuer: "supportdesk",
    audience: "supportdesk",
  });
export async function verify(token: string): Promise<Identity> {
  const value = jwt.verify(token, config.secret, {
    issuer: "supportdesk",
    audience: "supportdesk",
  }) as Identity;
  if (!value.id || !["staff", "customer"].includes(value.type))
    throw new Error("Invalid identity");
  if (value.type === "staff") {
    const user = await User.findById(value.id);
    if (!user?.active) throw new Error("Account unavailable");
    value.role = user.role;
    value.name = user.name;
  }
  return value;
}
export const auth: RequestHandler = async (req, res, next) => {
  try {
    req.identity = await verify(
      (req.headers.authorization || "").replace(/^Bearer /, ""),
    );
    next();
  } catch {
    res
      .status(401)
      .json({ error: "Your session has expired. Please sign in again." });
  }
};
export const staff: RequestHandler = (req, res, next) =>
  req.identity.type === "staff"
    ? next()
    : void res.status(403).json({ error: "Staff access required." });
export const admin: RequestHandler = (req, res, next) =>
  req.identity.type === "staff" && req.identity.role === "admin"
    ? next()
    : void res.status(403).json({ error: "Administrator access required." });
export async function permitted(identity: Identity, id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return Conversation.findOne(
    identity.type === "staff"
      ? { _id: id }
      : {
          _id: id,
          customer: identity.id,
          ...(identity.conversationId === id ? {} : { _id: null }),
        },
  );
}
