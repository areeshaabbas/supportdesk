import "dotenv/config";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("Set JWT_SECRET to at least 32 characters in .env");
export const config = {
  port: Number(process.env.PORT || 4000),
  mongo: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/supportdesk",
  redis: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  secret: process.env.JWT_SECRET,
  origin:
    process.env.WEB_ORIGIN ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://127.0.0.1:5173",
  delay: Number(process.env.REMINDER_DELAY_MS || 300000),
};
