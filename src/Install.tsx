import { useState } from "react";
import { Check, Paperclip, ArrowUpRight, MessageCircle } from "lucide-react";
export default function Install({
  demo,
  onPreview,
}: {
  demo: boolean;
  onPreview: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const code = `<script src="${location.origin}/widget.js" data-supportdesk="${location.origin}" defer></script>`;
  return (
    <section className="secondary-page install-page">
      <div className="eyebrow">AN OPEN DOOR</div>
      <h1>
        Be there when they need you<span>.</span>
      </h1>
      <p>A small widget. The start of a good conversation.</p>
      <div className="install-grid">
        <div className="install-card">
          <span className="step-number">01</span>
          <h2>Add it to your website.</h2>
          <p>
            Place this snippet before the closing body tag. It opens an
            isolated, accessible chat window connected to this workspace.
          </p>
          <pre>
            <code>{code}</code>
          </pre>
          <button
            className="button"
            onClick={() =>
              navigator.clipboard
                .writeText(code)
                .then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                })
                .catch(() => setCopied(false))
            }
          >
            {copied ? <Check size={15} /> : <Paperclip size={15} />}{" "}
            {copied ? "Copied" : "Copy embed code"}
          </button>
        </div>
        <div className="install-card warm">
          <span className="step-number">02</span>
          <h2>See the other side.</h2>
          <p>
            Start a conversation as a customer.{" "}
            {demo
              ? "This preview demonstrates the widget design. Sign in to test live delivery."
              : "Your message will appear in the shared inbox."}
          </p>
          <div className="widget-illustration">
            <MessageCircle size={38} />
            <span>Hello there. How can we help?</span>
          </div>
          <button className="button primary" onClick={onPreview}>
            Open the chat widget
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
      <p className="muted">
        For production, configure the public frontend and API origins. Customers
        receive a token scoped to their own conversation.
      </p>
    </section>
  );
}
