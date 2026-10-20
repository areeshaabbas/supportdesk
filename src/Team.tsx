import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Agent } from "./demo";
import { request } from "./api";
import { Avatar } from "./shared";
import { useDialog } from "./useDialog";
export default function Team({
  agents,
  demo,
  token,
  user,
  onRefresh,
  onError,
}: {
  agents: Agent[];
  demo: boolean;
  token: string | null;
  user: { role: string; id: string };
  onRefresh: () => void;
  onError: (s: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  useDialog(adding, () => setAdding(false));
  const [busy, setBusy] = useState(false);
  return (
    <section className="secondary-page">
      <div className="eyebrow">BETTER, TOGETHER</div>
      <div className="secondary-heading">
        <div>
          <h1>
            A team that shows up<span>.</span>
          </h1>
          <p>The people behind every thoughtful reply.</p>
        </div>
        {user.role === "admin" && (
          <button className="button primary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add teammate
          </button>
        )}
      </div>
      <div className="team-table">
        <div className="team-table-head">
          <span>TEAMMATE</span>
          <span>ROLE</span>
          <span>ACCESS</span>
        </div>
        {agents.map((a) => (
          <div className="team-row" key={a._id}>
            <div>
              <Avatar name={a.name} />
              <span>
                <strong>
                  {a.name}
                  {a._id === user.id ? " (you)" : ""}
                </strong>
                <small>{a.email}</small>
              </span>
            </div>
            <span className="role-tag">{a.role}</span>
            <span className="active-label">
              <i />
              Active
              {user.role === "admin" && a._id !== user.id && (
                <button
                  className="text-button"
                  onClick={async () => {
                    if (demo)
                      return onError(
                        "Agent changes are available in the live workspace.",
                      );
                    try {
                      await request(`/agents/${a._id}`, token, {
                        method: "PATCH",
                        body: JSON.stringify({ active: false }),
                      });
                      onRefresh();
                    } catch (e: any) {
                      onError(e.message);
                    }
                  }}
                >
                  Deactivate
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
      <p className="muted">
        Administrators manage access. Every active teammate can handle
        conversations.
      </p>
      {adding && (
        <div
          className="modal-backdrop"
          data-dialog
          role="dialog"
          aria-modal="true"
          aria-label="SupportDesk dialog"
          tabIndex={-1}
        >
          <form
            className="modal"
            onSubmit={async (e) => {
              e.preventDefault();
              if (demo) {
                onError(
                  "Sign in to the live workspace to create agent accounts.",
                );
                setAdding(false);
                return;
              }
              const data = Object.fromEntries(new FormData(e.currentTarget));
              setBusy(true);
              try {
                await request("/agents", token, {
                  method: "POST",
                  body: JSON.stringify(data),
                });
                onRefresh();
                setAdding(false);
              } catch (e: any) {
                onError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <button
              type="button"
              className="modal-close icon-button"
              aria-label="Close add teammate"
              onClick={() => setAdding(false)}
            >
              <X size={18} />
            </button>
            <h2>A new friendly face.</h2>
            <p>Create an account for your teammate.</p>
            <label>
              Full name
              <input name="name" required maxLength={80} />
            </label>
            <label>
              Email
              <input name="email" type="email" required />
            </label>
            <label>
              Temporary password
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
              />
              <small>At least 12 characters. Share privately.</small>
            </label>
            <label>
              Role
              <select name="role">
                <option value="agent">Agent</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <button className="send-button wide" disabled={busy}>
              {busy ? "Creating…" : "Create teammate"}
              <Plus size={15} />
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
