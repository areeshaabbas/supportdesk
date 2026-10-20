import type { Server } from "socket.io";
import { permitted, verify } from "./auth";
import { sendMessage } from "./messaging";
export function attachRealtime(io: Server) {
  io.use(async (socket, next) => {
    try {
      socket.data.identity = await verify(socket.handshake.auth.token);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    const identity = socket.data.identity;
    socket.join(`user:${identity.id}`);
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, identity.exp * 1000 - Date.now()),
    );
    socket.on("disconnect", () => clearTimeout(expiry));
    // Recheck expiry and active staff membership for every event, not just at login.
    socket.use(async (_event, next) => {
      try {
        await verify(socket.handshake.auth.token);
        next();
      } catch {
        next(new Error("Unauthorized"));
        socket.disconnect(true);
      }
    });
    if (identity.type === "staff") socket.join("staff");
    socket.on("join", async (id, ack) => {
      try {
        if (typeof id !== "string" || !(await permitted(identity, id)))
          return ack?.({ error: "Conversation not found." });
        for (const room of socket.rooms)
          if (room.startsWith("conversation:")) socket.leave(room);
        await socket.join(`conversation:${id}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ error: "Unable to join conversation." });
      }
    });
    socket.on("message:send", async (data, ack) => {
      try {
        const message = await sendMessage(
          identity,
          data.conversationId,
          data,
          io,
        );
        ack?.({ message });
      } catch (error: any) {
        ack?.({ error: error.message });
      }
    });
    let lastTyping = 0;
    socket.on("typing", async (id) => {
      if (Date.now() - lastTyping < 1000) return;
      lastTyping = Date.now();
      try {
        if (
          typeof id === "string" &&
          socket.rooms.has(`conversation:${id}`) &&
          (await permitted(identity, id))
        )
          socket
            .to(`conversation:${id}`)
            .emit("typing", { name: identity.name, type: identity.type });
      } catch {
        /* Typing is ephemeral; a temporary lookup failure can be ignored. */
      }
    });
  });
}
