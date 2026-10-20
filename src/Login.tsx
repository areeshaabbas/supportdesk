import { useState } from "react";
import { X, Headphones, ArrowRight } from "lucide-react";
import { request } from "./api";
import { useDialog } from "./useDialog";
export default function Login({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (data: any) => void;
}) {
  useDialog(true, onClose);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
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
          const form = new FormData(e.currentTarget);
          setBusy(true);
          setError("");
          try {
            onSuccess(
              await request("/auth/login", null, {
                method: "POST",
                body: JSON.stringify(Object.fromEntries(form)),
              }),
            );
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <button
          type="button"
          className="modal-close icon-button"
          onClick={onClose}
          aria-label="Close sign in"
        >
          <X size={18} />
        </button>
        <span className="brand-icon">
          <Headphones size={22} />
        </span>
        <h2>Welcome back.</h2>
        <p>Sign in to your team’s live workspace.</p>
        {import.meta.env.VITE_PUBLIC_DEMO === "true" && (
          <>
            <button
              type="button"
              className="send-button wide"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  onSuccess(
                    await request("/auth/demo", null, { method: "POST" }),
                  );
                } catch (e: unknown) {
                  setError(
                    e instanceof Error ? e.message : "Unable to open the demo.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Opening workspace…" : "Explore the live demo"}
              <ArrowRight size={15} />
            </button>
            <small className="muted">
              A shared demo workspace with sample data. No account needed.
              Please use fictional customer details.
            </small>
          </>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@company.com"
            required
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="send-button wide" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
          <ArrowRight size={15} />
        </button>
        <small className="muted">
          {import.meta.env.VITE_PUBLIC_DEMO === "true"
            ? "Staff can also sign in with their own account."
            : "Requires the API, MongoDB and Redis. See the project README for setup."}
        </small>
      </form>
    </div>
  );
}
