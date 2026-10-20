import { Queue } from "bullmq";
import { config } from "./config";
const url = new URL(config.redis);
export const connection = {
  host: url.hostname,
  port: Number(url.port || 6379),
  db: Number(url.pathname.slice(1) || 0),
  username: url.username || undefined,
  password: decodeURIComponent(url.password) || undefined,
  ...(url.protocol === "rediss:" ? { tls: {} } : {}),
};
export const reminders = new Queue("unanswered", {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});
reminders.on("error", (error) =>
  console.error("Reminder queue:", error.message),
);
export async function scheduleReminder(conversation: string, message: string) {
  await reminders.add(
    "remind",
    { conversation, message },
    { jobId: `reminder-${message}`, delay: config.delay },
  );
}
