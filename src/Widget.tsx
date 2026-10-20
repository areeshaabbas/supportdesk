import { useState, useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { Headphones, ArrowRight, MessageCircle, Send } from "lucide-react";
import type { Message } from "./demo";
import { request } from "./api";
import { time, merge } from "./shared";
export default function Widget({
  standalone = false,
  demo = false,
}: {
  standalone?: boolean;
  demo?: boolean;
}) {
  const [token, setToken] = useState<string | null>(
    demo ? null : sessionStorage.getItem("sd.customer"),
  );
  const [id, setId] = useState(
    demo ? "" : sessionStorage.getItem("sd.conversation") || "",
  );
  const [items, setItems] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState("");
  const [older, setOlder] = useState(false);
  const sock = useRef<Socket | null>(null);
  const last = useRef<Message | undefined>(undefined);
  last.current = items.filter((m) => m.state === "sent").at(-1);
  const end = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (demo || !token || !id) return;
    let disposed = false;
    async function sync(after?: string) {
      let cursor = after;
      let more = true;
      while (more && !disposed) {
        const data = await request(
          `/conversations/${id}/messages${cursor ? `?after=${cursor}` : ""}`,
          token,
        );
        if (disposed) return;
        setItems((old) => merge(old, data.items));
        if (!cursor) setOlder(data.hasMore);
        more = Boolean(cursor && data.hasMore && data.items.length);
        cursor = data.items.at(-1)?._id;
      }
    }
    const s = io(import.meta.env.VITE_API_URL || undefined, {
      auth: { token },
    });
    sock.current = s;
    s.on("connect", () => {
      setOnline(true);
      s.emit("join", id);
      sync(last.current?._id).catch((e) => setError(e.message));
    });
    s.on("disconnect", () => setOnline(false));
    s.on("connect_error", () =>
      setError("Chat connection interrupted. Your messages can be retried."),
    );
    s.on("message", (m: Message) => setItems((old) => merge(old, [m])));
    s.on("typing", (data) => {
      if (data.type === "staff") {
        setTyping(data.name);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setTyping(""), 2500);
      }
    });
    return () => {
      disposed = true;
      s.disconnect();
      clearTimeout(timer.current);
    };
  }, [id, token, demo]);
  useEffect(() => {
    const scroller = end.current?.parentElement;
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    const m = items.at(-1);
    if (
      m &&
      token &&
      m.state === "sent" &&
      document.visibilityState === "visible"
    )
      request(`/conversations/${id}/read`, token, {
        method: "POST",
        body: JSON.stringify({ messageId: m._id }),
      }).catch(() => {});
  }, [items.length]);
  async function send(existing?: Message) {
    if (!draft.trim() && !existing) return;
    const m = existing || {
      _id: crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      conversation: id,
      content: draft.trim(),
      senderType: "customer" as const,
      senderName: "You",
      createdAt: new Date().toISOString(),
    };
    setDraft("");
    setItems((old) =>
      merge(old, [m]).map((x) =>
        x.clientId === m.clientId ? { ...x, state: "sending" } : x,
      ),
    );
    try {
      const saved = demo
        ? m
        : await request(`/conversations/${id}/messages`, token, {
            method: "POST",
            body: JSON.stringify({ content: m.content, clientId: m.clientId }),
          });
      setItems((old) => merge(old, [saved]));
      if (demo)
        setTimeout(
          () =>
            setItems((old) =>
              merge(old, [
                {
                  ...m,
                  _id: crypto.randomUUID(),
                  clientId: crypto.randomUUID(),
                  senderType: "staff",
                  senderName: "SupportDesk preview",
                  content:
                    "This is a design preview. In the live workspace, your message goes directly to the support team.",
                  createdAt: new Date().toISOString(),
                },
              ]),
            ),
          700,
        );
    } catch (e: any) {
      setError(e.message);
      setItems((old) =>
        old.map((x) =>
          x.clientId === m.clientId ? { ...x, state: "failed" } : x,
        ),
      );
    }
  }
  return (
    <div className={standalone ? "widget-standalone" : "widget-container"}>
      <section className="chat-widget">
        <header>
          <span className="brand-icon">
            <Headphones size={23} />
          </span>
          <h2>
            A real person.
            <br />A little help.
          </h2>
          <p>
            <i />
            {demo
              ? "Interactive design preview"
              : online
                ? "You’re connected to the team"
                : "Leave us a message. We’ll be in touch."}
          </p>
        </header>
        {!id ? (
          <form
            className="widget-intro"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              const data = Object.fromEntries(new FormData(e.currentTarget));
              try {
                if (demo) {
                  setId("preview");
                  setItems([]);
                } else {
                  const session = await request("/widget/sessions", null, {
                    method: "POST",
                    body: JSON.stringify(data),
                  });
                  sessionStorage.setItem("sd.customer", session.token);
                  sessionStorage.setItem(
                    "sd.conversation",
                    session.conversation._id,
                  );
                  setToken(session.token);
                  setId(session.conversation._id);
                }
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h3>Hello there 👋</h3>
            <p>Tell us a little about yourself, and we’ll take it from here.</p>
            <label>
              Your name
              <input
                name="name"
                placeholder="Maya Patel"
                required
                maxLength={80}
              />
            </label>
            <label>
              Email address
              <input
                name="email"
                type="email"
                placeholder="maya@company.com"
                required
              />
            </label>
            <label>
              What can we help with?
              <input
                name="subject"
                placeholder="A question about my account"
                required
                maxLength={160}
              />
            </label>
            <button className="send-button wide" disabled={busy}>
              {busy ? "Starting…" : "Start a conversation"}
              <ArrowRight size={15} />
            </button>
          </form>
        ) : (
          <>
            <div className="widget-messages">
              {older && (
                <button
                  className="text-button"
                  onClick={async () => {
                    try {
                      const data = await request(
                        `/conversations/${id}/messages?before=${items[0]._id}`,
                        token,
                      );
                      setItems((old) => merge(old, data.items));
                      setOlder(data.hasMore);
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                >
                  Earlier messages
                </button>
              )}
              {!items.length && (
                <div className="widget-welcome">
                  <MessageCircle size={24} />
                  <h3>You’re in the right place.</h3>
                  <p>Send your question below. Our team will reply here.</p>
                </div>
              )}
              {items.map((m) => (
                <div
                  key={`${m.senderType}:${m.clientId}`}
                  className={`widget-message ${m.senderType === "customer" ? "self" : ""}`}
                >
                  <span>
                    {m.senderType === "customer" ? "You" : m.senderName} ·{" "}
                    {time(m.createdAt)}
                  </span>
                  <p>{m.content}</p>
                  {m.state === "failed" ? (
                    <button
                      className="text-button failed"
                      onClick={() => send(m)}
                    >
                      Failed · Retry
                    </button>
                  ) : m.state === "sending" ? (
                    <small>Sending…</small>
                  ) : m.senderType === "customer" ? (
                    <small>Sent</small>
                  ) : null}
                </div>
              ))}
              {typing && <p className="typing">{typing} is typing…</p>}
              <div ref={end} />
            </div>
            <form
              className="widget-compose"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                aria-label="Your message"
                placeholder="Write your message…"
                value={draft}
                maxLength={5000}
                onChange={(e) => {
                  setDraft(e.target.value);
                  sock.current?.emit("typing", id);
                }}
              />
              <button aria-label="Send message" disabled={!draft.trim()}>
                <Send size={18} />
              </button>
            </form>
          </>
        )}
        {error && (
          <div className="widget-error" role="alert">
            {error}
            <button
              onClick={() => {
                sessionStorage.removeItem("sd.customer");
                sessionStorage.removeItem("sd.conversation");
                setToken(null);
                setId("");
                setItems([]);
                setError("");
              }}
            >
              Start again
            </button>
          </div>
        )}
        <footer>
          Thoughtful support, powered by <strong>supportdesk.</strong>
        </footer>
      </section>
    </div>
  );
}
