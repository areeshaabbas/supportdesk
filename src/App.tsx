import { useDialog } from "./useDialog";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  Inbox,
  Users,
  Check,
  Search,
  ArrowUpRight,
  ChevronDown,
  Send,
  MessageCircle,
  Clock,
  CheckCheck,
  Command,
  LogOut,
  PanelRightClose,
  ArrowRight,
  X,
  Globe,
  Mail,
  AlertCircle,
  RotateCw,
  Headphones,
  BookOpen,
} from "lucide-react";
import {
  demoAgents,
  demoConversations,
  demoMessages,
  type Conversation,
  type Message,
  type Agent,
} from "./demo";
import { request } from "./api";
import { initials, time, relative, Avatar, merge } from "./shared";
import Login from "./Login";
import Team from "./Team";
import Install from "./Install";
import Widget from "./Widget";
export default function App() {
  const [token, setToken] = useState<string | null>(
    sessionStorage.getItem("sd.staff"),
  );
  const [demo, setDemo] = useState(!token);
  const [login, setLogin] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>(
    token ? [] : demoConversations,
  );
  const [agents, setAgents] = useState<Agent[]>(demoAgents);
  const [messages, setMessages] = useState<Message[]>(
    token ? [] : demoMessages,
  );
  const [selected, setSelected] = useState(token ? "" : "c1");
  const [filter, setFilter] = useState("open");
  const [assignment, setAssignment] = useState("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [view, setView] = useState("inbox");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  const [typing, setTyping] = useState("");
  const [read, setRead] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [detail, setDetail] = useState(true);
  const [widget, setWidget] = useState(false);
  const [help, setHelp] = useState(false);
  useDialog(widget || help, () => {
    setWidget(false);
    setHelp(false);
  });
  const [user, setUser] = useState({
    id: "a1",
    name: "Alex Morgan",
    role: "admin",
  });
  const [counts, setCounts] = useState<Record<string, number>>({
    open: 4,
    pending: 2,
    resolved: 2,
  });
  const socket = useRef<Socket | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const inboxRequest = useRef(0);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const active = conversations.find((c) => c._id === selected);
  const thread = messages.filter((m) => m.conversation === selected);
  const latestRef = useRef<Message | undefined>(undefined);
  latestRef.current = thread
    .filter((m) => m.state !== "failed" && m.state !== "sending")
    .at(-1);
  useEffect(() => {
    if (!demo && token) {
      request("/auth/me", token)
        .then(setUser)
        .catch((e) => setError(e.message));
      request("/agents", token)
        .then(setAgents)
        .catch((e) => setError(e.message));
    }
  }, [token, demo]);
  async function loadInbox(before?: string) {
    if (demo || !token) return;
    const generation = ++inboxRequest.current;
    const q = new URLSearchParams();
    if (filter !== "all") q.set("status", filter);
    if (assignment !== "all")
      q.set("assigned", assignment === "mine" ? user.id : assignment);
    if (search) q.set("q", search);
    if (before) q.set("before", before);
    setLoading(true);
    try {
      const data = await request(`/conversations?${q}`, token);
      if (generation !== inboxRequest.current) return;
      setConversations((old) =>
        before
          ? [
              ...old,
              ...data.items.filter(
                (x: Conversation) => !old.some((y) => y._id === x._id),
              ),
            ]
          : data.items,
      );
      setCounts(data.counts);
      setNextPage(data.next);
      if (
        !before &&
        !data.items.some((c: Conversation) => c._id === selectedRef.current)
      )
        setSelected(data.items[0]?._id || "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (generation === inboxRequest.current) setLoading(false);
    }
  }
  useEffect(() => {
    const timeout = setTimeout(() => void loadInbox(), 200);
    return () => clearTimeout(timeout);
  }, [demo, token, filter, assignment, search, user.id]);
  async function recover(id: string, after?: string) {
    if (!token || demo) return;
    let cursor = after;
    let more = true;
    while (more) {
      const result = await request(
        `/conversations/${id}/messages${cursor ? `?after=${cursor}` : ""}`,
        token,
      );
      setMessages((old) => merge(old, result.items));
      more = Boolean(cursor && result.hasMore && result.items.length);
      cursor = result.items.at(-1)?._id;
      if (!after) setHasOlder(result.hasMore);
    }
  }
  useEffect(() => {
    setDraft("");
    setTyping("");
    setRead("");
    if (demo || !token || !selected) return;
    let cancelled = false;
    setMessages((old) => old.filter((m) => m.conversation !== selected));
    recover(selected).catch((e) => !cancelled && setError(e.message));
    socket.current?.emit("join", selected);
    return () => {
      cancelled = true;
    };
  }, [selected, token, demo]);
  useEffect(() => {
    if (demo || !token) return;
    const s = io(import.meta.env.VITE_API_URL || undefined, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socket.current = s;
    s.on("connect", () => {
      setConnected(true);
      const id = selectedRef.current;
      if (id) {
        s.emit("join", id);
        recover(id, latestRef.current?._id).catch((e) => setError(e.message));
      }
      void loadInbox();
    });
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", () => {
      setConnected(false);
      setError("Connection lost. Messages can still be retried.");
    });
    s.on("message", (m: Message) => setMessages((old) => merge(old, [m])));
    s.on("inbox:changed", () => void loadInbox());
    s.on("conversation:changed", (c: Conversation) =>
      setConversations((old) => old.map((x) => (x._id === c._id ? c : x))),
    );
    s.on("typing", (data) => {
      if (data.type === "customer") {
        setTyping(data.name);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(""), 2500);
      }
    });
    s.on("read", (data) => {
      if (data.type === "customer") setRead(data.messageId);
    });
    return () => {
      s.disconnect();
      socket.current = null;
      clearTimeout(typingTimer.current);
    };
  }, [token, demo, filter, assignment, search]);
  useEffect(() => {
    const scroller = bottom.current?.parentElement;
    scroller?.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    const last = thread.at(-1);
    if (
      !demo &&
      token &&
      last &&
      last.state !== "sending" &&
      last.state !== "failed" &&
      document.visibilityState === "visible"
    )
      request(`/conversations/${selected}/read`, token, {
        method: "POST",
        body: JSON.stringify({ messageId: last._id }),
      }).catch(() => {});
  }, [selected, thread.length]);
  async function update(
    data: Partial<Conversation> | { assignedTo: string | null },
  ) {
    if (!active) return;
    try {
      if (demo)
        setConversations((old) =>
          old.map((c) =>
            c._id === selected
              ? {
                  ...c,
                  ...data,
                  assignedTo:
                    "assignedTo" in data
                      ? agents.find((a) => a._id === data.assignedTo) || null
                      : c.assignedTo,
                }
              : c,
          ),
        );
      else {
        const result = await request(`/conversations/${selected}`, token, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        setConversations((old) =>
          old.map((c) => (c._id === selected ? result : c)),
        );
      }
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function send(existing?: Message) {
    if (!active || (!draft.trim() && !existing)) return;
    const msg = existing || {
      _id: crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      conversation: selected,
      content: draft.trim(),
      senderType: "staff" as const,
      senderName: user.name,
      createdAt: new Date().toISOString(),
    };
    setDraft("");
    setMessages((old) =>
      merge(old, [msg]).map((m) =>
        m.clientId === msg.clientId ? { ...m, state: "sending" } : m,
      ),
    );
    try {
      const saved = demo
        ? { ...msg, state: "sent" }
        : await request(`/conversations/${selected}/messages`, token, {
            method: "POST",
            body: JSON.stringify({
              content: msg.content,
              clientId: msg.clientId,
            }),
          });
      setMessages((old) => merge(old, [saved]));
      if (demo)
        setConversations((old) =>
          old.map((c) =>
            c._id === selected
              ? { ...c, lastMessage: msg.content, updatedAt: msg.createdAt }
              : c,
          ),
        );
    } catch (e: any) {
      setMessages((old) =>
        old.map((m) =>
          m.clientId === msg.clientId ? { ...m, state: "failed" } : m,
        ),
      );
      setError(e.message);
    }
  }
  async function older() {
    if (!thread[0]) return;
    try {
      const data = await request(
        `/conversations/${selected}/messages?before=${thread[0]._id}`,
        token,
      );
      setMessages((old) => merge(old, data.items));
      setHasOlder(data.hasMore);
    } catch (e: any) {
      setError(e.message);
    }
  }
  const filtered = demo
    ? conversations.filter(
        (c) =>
          (filter === "all" || c.status === filter) &&
          (assignment === "all" ||
            (assignment === "mine"
              ? c.assignedTo?._id === user.id
              : !c.assignedTo)) &&
          `${c.customer.name} ${c.customer.email} ${c.subject} ${c.lastMessage} ${messages
            .filter((m) => m.conversation === c._id)
            .map((m) => m.content)
            .join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
    : conversations;
  useEffect(() => {
    if (demo && !filtered.some((c) => c._id === selected))
      setSelected(filtered[0]?._id || "");
  }, [demo, filter, assignment, search, conversations]);
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="SupportDesk home">
          <span className="brand-icon">
            <Headphones size={22} />
          </span>
          supportdesk<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-logo">F</span>
          <span>
            <strong>Form & Field</strong>
            <small>Team workspace</small>
          </span>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          <button
            className={view === "inbox" ? "nav active" : "nav"}
            onClick={() => setView("inbox")}
          >
            <Inbox size={18} />
            Team inbox
            <span className="nav-count">
              {demo
                ? conversations.filter((c) => c.status === "open").length
                : counts.open || 0}
            </span>
          </button>
          <button
            className={view === "team" ? "nav active" : "nav"}
            onClick={() => setView("team")}
          >
            <Users size={18} />
            Teammates<span className="nav-muted">{agents.length}</span>
          </button>
          <button
            className={view === "install" ? "nav active" : "nav"}
            onClick={() => setView("install")}
          >
            <MessageCircle size={18} />
            Chat widget
            <ArrowUpRight size={14} className="nav-muted" />
          </button>
        </nav>
        <div className="sidebar-rule" />
        <div className="nav-label">YOUR WORK</div>
        <button
          className="nav"
          onClick={() => {
            setView("inbox");
            setAssignment("mine");
            setFilter("open");
          }}
        >
          <span className="tiny-dot" />
          Assigned to me
          <span className="nav-muted">
            {demo
              ? conversations.filter(
                  (c) => c.assignedTo?._id === user.id && c.status === "open",
                ).length
              : "→"}
          </span>
        </button>
        <button
          className="nav"
          onClick={() => {
            setView("inbox");
            setAssignment("unassigned");
            setFilter("open");
          }}
        >
          <span className="tiny-dot amber" />
          Unassigned
          <span className="nav-muted">
            {demo
              ? conversations.filter(
                  (c) => !c.assignedTo && c.status === "open",
                ).length
              : "→"}
          </span>
        </button>
        <div className="sidebar-bottom">
          <div className="care-card">
            <span className="care-mark">✳</span>
            <strong>A little care goes a long way.</strong>
            <p>
              Good conversations make
              <br />
              great customer relationships.
            </p>
            <button onClick={() => setHelp(true)}>
              The support playbook <ArrowUpRight size={13} />
            </button>
          </div>
          <button className="nav" onClick={() => setHelp(true)}>
            <BookOpen size={17} />
            Help & shortcuts<span className="key">?</span>
          </button>
          <button
            className="profile"
            onClick={() =>
              demo
                ? setLogin(true)
                : (sessionStorage.removeItem("sd.staff"),
                  setToken(null),
                  setDemo(true),
                  setConversations(demoConversations),
                  setMessages(demoMessages),
                  setAgents(demoAgents),
                  setUser({ id: "a1", name: "Alex Morgan", role: "admin" }),
                  setSelected("c1"))
            }
          >
            <Avatar name={user.name} small />
            <span>
              <strong>{user.name}</strong>
              <small>{demo ? "Preview workspace" : user.role}</small>
            </span>
            {demo ? <ChevronDown size={15} /> : <LogOut size={15} />}
          </button>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {view === "inbox"
                ? "Team inbox"
                : view === "team"
                  ? "Teammates"
                  : "Chat widget"}
            </strong>
          </div>
          <div className="top-actions">
            <span className={`connection ${demo || connected ? "online" : ""}`}>
              <i />
              {demo ? "Preview mode" : connected ? "Connected" : "Reconnecting"}
            </span>
            {demo && (
              <button
                className="button small-button"
                onClick={() => setLogin(true)}
              >
                Sign in to live workspace <ArrowRight size={13} />
              </button>
            )}
          </div>
        </header>
        {error && (
          <div className="error" role="alert">
            <AlertCircle size={16} />
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {view === "inbox" ? (
          <>
            <section className="page-heading">
              <div>
                <div className="eyebrow">A LITTLE MORE HUMAN</div>
                <h1>
                  Good support starts here<span>.</span>
                </h1>
                <p>Your team’s conversations, all in one place.</p>
              </div>
              <button className="button" onClick={() => setWidget(true)}>
                <Globe size={15} />
                Try the customer experience
                <ArrowUpRight size={14} />
              </button>
            </section>
            <div className="inbox-toolbar">
              <div className="tabs">
                {["open", "pending", "resolved", "all"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setFilter(status)}
                    className={filter === status ? "tab selected" : "tab"}
                  >
                    {status === "open" ? (
                      <Inbox size={15} />
                    ) : status === "pending" ? (
                      <Clock size={15} />
                    ) : status === "resolved" ? (
                      <CheckCheck size={15} />
                    ) : null}
                    {status === "all"
                      ? "All conversations"
                      : status[0].toUpperCase() + status.slice(1)}
                    <span>
                      {demo
                        ? conversations.filter(
                            (c) => status === "all" || c.status === status,
                          ).length
                        : status === "all"
                          ? Object.values(counts).reduce((a, b) => a + b, 0)
                          : counts[status] || 0}
                    </span>
                  </button>
                ))}
              </div>
              <div className="toolbar-right">
                <label className="assignment">
                  <Users size={14} />
                  <select
                    aria-label="Filter by assignment"
                    value={assignment}
                    onChange={(e) => setAssignment(e.target.value)}
                  >
                    <option value="all">Everyone</option>
                    <option value="mine">Assigned to me</option>
                    <option value="unassigned">Unassigned</option>
                  </select>
                </label>
                <button
                  className="icon-button"
                  aria-label="Toggle customer details"
                  onClick={() => setDetail(!detail)}
                >
                  <PanelRightClose size={17} />
                </button>
              </div>
            </div>
            <div className={`inbox-layout ${detail ? "" : "hide-detail"}`}>
              <section className="conversation-list">
                <label className="search">
                  <Search size={16} />
                  <input
                    aria-label="Search conversations"
                    placeholder="Search conversations…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </label>
                <div className="list-heading">
                  <span>
                    {loading ? "Updating…" : `${filtered.length} conversations`}
                  </span>
                  <span>Recent first</span>
                </div>
                <div className="list-scroll">
                  {filtered.map((c) => (
                    <button
                      className={`conversation-item ${selected === c._id ? "current" : ""}`}
                      key={c._id}
                      onClick={() => setSelected(c._id)}
                    >
                      <div className="item-top">
                        <Avatar name={c.customer.name} small />
                        <strong>{c.customer.name}</strong>
                        <time>{relative(c.updatedAt)}</time>
                      </div>
                      <h3>{c.subject}</h3>
                      <p>{c.lastMessage || "New conversation"}</p>
                      <div className="item-footer">
                        <span className={`status-dot ${c.status}`} />
                        <span>
                          {c.status === "open"
                            ? "Needs a reply"
                            : c.status === "pending"
                              ? "Waiting on customer"
                              : "Resolved"}
                        </span>
                        {c.assignedTo ? (
                          <span
                            className="assignee-mini"
                            title={c.assignedTo.name}
                          >
                            {initials(c.assignedTo.name)}
                          </span>
                        ) : (
                          <span className="unassigned">Unassigned</span>
                        )}
                      </div>
                    </button>
                  ))}
                  {!filtered.length && (
                    <div className="empty">
                      <Inbox size={25} />
                      <h3>{search ? "No matches found" : "All caught up"}</h3>
                      <p>
                        {search
                          ? "Try another name or phrase."
                          : "No conversations in this view."}
                      </p>
                    </div>
                  )}
                  {nextPage && !demo && (
                    <button
                      className="text-button load-more"
                      onClick={() => loadInbox(nextPage)}
                    >
                      Load more conversations
                    </button>
                  )}
                </div>
                <div className="list-bottom">
                  <i />A shared inbox. A personal touch.
                </div>
              </section>
              {active ? (
                <section className="thread">
                  <header className="thread-header">
                    <div>
                      <h2>{active.subject}</h2>
                      <span>
                        <span className={`status-dot ${active.status}`} />
                        {active.status[0].toUpperCase() +
                          active.status.slice(1)}
                        <b>·</b>Web chat <b>·</b> #
                        {active._id.replace("c", "").slice(-4).padStart(4, "0")}
                      </span>
                    </div>
                    <button
                      className={`button resolve ${active.status === "resolved" ? "resolved" : ""}`}
                      onClick={() =>
                        update({
                          status:
                            active.status === "resolved" ? "open" : "resolved",
                        })
                      }
                    >
                      <Check size={16} />
                      {active.status === "resolved" ? "Reopen" : "Resolve"}
                    </button>
                  </header>
                  <div className="thread-body">
                    {hasOlder && !demo && (
                      <button className="text-button load-more" onClick={older}>
                        Load earlier messages
                      </button>
                    )}
                    <div className="date-divider">
                      <span>
                        {new Date(active.createdAt).toLocaleDateString([], {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="conversation-start">
                      <Globe size={13} />
                      Conversation started from your website
                    </div>
                    {thread.map((m) => (
                      <div
                        key={`${m.senderType}:${m.clientId}`}
                        className={`message-row ${m.senderType === "staff" ? "outgoing" : ""}`}
                      >
                        {m.senderType === "customer" && (
                          <Avatar name={m.senderName} small />
                        )}
                        <div className="message-wrap">
                          <div className="message-meta">
                            <strong>
                              {m.senderType === "staff"
                                ? "You"
                                : m.senderName.split(" ")[0]}
                            </strong>
                            <time>{time(m.createdAt)}</time>
                          </div>
                          <div className="bubble">{m.content}</div>
                          {m.senderType === "staff" && (
                            <div
                              className={`delivery ${m.state === "failed" ? "failed" : ""}`}
                            >
                              {m.state === "failed" ? (
                                <button onClick={() => send(m)}>
                                  <RotateCw size={11} />
                                  Failed · Retry
                                </button>
                              ) : m.state === "sending" ? (
                                "Sending…"
                              ) : (
                                <>
                                  <CheckCheck size={12} />
                                  {read && m._id <= read ? "Read" : "Sent"}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {typing && (
                      <div className="typing">
                        {typing} is typing<span>•••</span>
                      </div>
                    )}
                    <div ref={bottom} />
                  </div>
                  <div className="composer-area">
                    <div className="reply-context">
                      <span className="reply-dot" />
                      Reply to <strong>{active.customer.name}</strong>
                      <span className="reply-email">
                        {active.customer.email}
                      </span>
                    </div>
                    <form
                      className="composer"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void send();
                      }}
                    >
                      <textarea
                        aria-label="Write a reply"
                        placeholder={`Write a thoughtful reply to ${active.customer.name.split(" ")[0]}…`}
                        value={draft}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          if (!demo) socket.current?.emit("typing", selected);
                        }}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                            e.preventDefault();
                            void send();
                          }
                        }}
                      />
                      <div className="composer-tools">
                        <span>
                          Plain text{" "}
                          <span className="muted">· Be clear, be kind.</span>
                        </span>
                        <button
                          className="send-button"
                          disabled={!draft.trim()}
                          type="submit"
                        >
                          Send reply
                          <Send size={14} />
                        </button>
                      </div>
                    </form>
                    <div className="composer-hint">
                      <span>
                        <Command size={11} /> + Enter to send
                      </span>
                      <span>Visible to the customer</span>
                    </div>
                  </div>
                </section>
              ) : (
                <section className="thread empty">
                  <MessageCircle size={32} />
                  <h2>A fresh start.</h2>
                  <p>Select a conversation to get the details.</p>
                </section>
              )}
              {detail && active && (
                <aside className="customer-panel">
                  <div className="panel-title">
                    Customer details
                    <button
                      className="icon-button"
                      aria-label="Hide customer details"
                      onClick={() => setDetail(false)}
                    >
                      <PanelRightClose size={16} />
                    </button>
                  </div>
                  <div className="customer-profile">
                    <Avatar name={active.customer.name} />
                    <h3>{active.customer.name}</h3>
                    <span>Customer</span>
                    <a href={`mailto:${active.customer.email}`}>
                      <Mail size={12} />
                      {active.customer.email}
                    </a>
                  </div>
                  <div className="detail-section">
                    <h4>CONVERSATION</h4>
                    <label>
                      Assigned to
                      <select
                        aria-label="Assign conversation"
                        value={active.assignedTo?._id || ""}
                        onChange={(e) =>
                          update({ assignedTo: e.target.value || null })
                        }
                      >
                        <option value="">Unassigned</option>
                        {agents.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!active.assignedTo && (
                      <button
                        className="text-button"
                        onClick={() => update({ assignedTo: user.id })}
                      >
                        Assign to me <ArrowRight size={12} />
                      </button>
                    )}
                    <label>
                      Status
                      <select
                        aria-label="Conversation status"
                        value={active.status}
                        onChange={(e) =>
                          update({
                            status: e.target.value as Conversation["status"],
                          })
                        }
                      >
                        <option value="open">Open</option>
                        <option value="pending">Pending</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </label>
                    <div className="detail-pair">
                      <span>Channel</span>
                      <strong>
                        <Globe size={13} />
                        Website chat
                      </strong>
                    </div>
                    <div className="detail-pair">
                      <span>Created</span>
                      <strong>
                        {new Date(active.createdAt).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </strong>
                    </div>
                  </div>
                  <div className="detail-section">
                    <h4>GOOD TO KNOW</h4>
                    <div className="customer-note">
                      <MessageCircle size={16} />
                      <p>
                        A name, not a ticket number.
                        <br />
                        <span>A little context makes every reply better.</span>
                      </p>
                    </div>
                  </div>
                  <div className="panel-foot">
                    <span className="tiny-dot" /> Every conversation matters.
                  </div>
                </aside>
              )}
            </div>
          </>
        ) : view === "team" ? (
          <Team
            agents={agents}
            demo={demo}
            token={token}
            user={user}
            onRefresh={() => request("/agents", token).then(setAgents)}
            onError={setError}
          />
        ) : (
          <Install demo={demo} onPreview={() => setWidget(true)} />
        )}
      </main>
      {login && (
        <Login
          onClose={() => setLogin(false)}
          onSuccess={(data) => {
            sessionStorage.setItem("sd.staff", data.token);
            setToken(data.token);
            setUser(data.user);
            setDemo(false);
            setConversations([]);
            setMessages([]);
            setSelected("");
            setLogin(false);
            setError("");
          }}
        />
      )}
      {widget && (
        <div
          className="modal-backdrop"
          data-dialog
          role="dialog"
          aria-modal="true"
          aria-label="SupportDesk dialog"
          tabIndex={-1}
          onClick={() => setWidget(false)}
        >
          <div className="widget-demo" onClick={(e) => e.stopPropagation()}>
            <button
              className="widget-close icon-button"
              onClick={() => setWidget(false)}
              aria-label="Close widget preview"
            >
              <X size={18} />
            </button>
            <Widget standalone={false} demo={demo} />
          </div>
        </div>
      )}
      {help && (
        <div
          className="modal-backdrop"
          data-dialog
          role="dialog"
          aria-modal="true"
          aria-label="SupportDesk dialog"
          tabIndex={-1}
          onClick={() => setHelp(false)}
        >
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close icon-button"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
            <div className="eyebrow">THE SUPPORT PLAYBOOK</div>
            <h2>Make every reply count.</h2>
            <p>
              Start by acknowledging the question. Give a clear next step. Read
              your reply once before sending it.
            </p>
            <div className="help-row">
              <strong>Claim the conversation</strong>
              <span>Choose “Assign to me” in customer details.</span>
            </div>
            <div className="help-row">
              <strong>Waiting for the customer?</strong>
              <span>
                Set the status to Pending. A new customer message reopens it.
              </span>
            </div>
            <div className="help-row">
              <strong>Close the loop</strong>
              <span>
                Resolve the conversation when the question is answered.
              </span>
            </div>
            <div className="help-row">
              <strong>Send a reply</strong>
              <span>Ctrl / ⌘ + Enter</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
