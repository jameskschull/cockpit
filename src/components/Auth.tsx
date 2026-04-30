import { useState } from "react";
import { supabase } from "../lib/supabase";

type Status = "idle" | "sending" | "sent" | "error";

export function Auth() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || status === "sending") return;
    setStatus("sending");
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">Cockpit</h1>
        <p className="auth-subtitle">Sign in with a magic link.</p>
        {status === "sent" ? (
          <p className="auth-sent">
            Check <strong>{email}</strong> for a link.
          </p>
        ) : (
          <form onSubmit={submit} className="auth-form">
            <input
              type="email"
              autoComplete="email"
              autoFocus
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-input"
            />
            <button
              type="submit"
              className="auth-submit"
              disabled={status === "sending" || !email.trim()}
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {errorMsg && <p className="auth-error">{errorMsg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
