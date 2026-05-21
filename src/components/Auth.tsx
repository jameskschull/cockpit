import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type Step = "email" | "code";
type Status = "idle" | "sending" | "verifying" | "error";

const RESEND_COOLDOWN_SECONDS = 60;

export function Auth() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef<number | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownTimer.current !== null) {
        window.clearInterval(cooldownTimer.current);
        cooldownTimer.current = null;
      }
      return;
    }
    if (cooldownTimer.current === null) {
      cooldownTimer.current = window.setInterval(() => {
        setCooldown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
    }
    return () => {
      if (cooldownTimer.current !== null) {
        window.clearInterval(cooldownTimer.current);
        cooldownTimer.current = null;
      }
    };
  }, [cooldown > 0]);

  const requestCode = async (targetEmail: string) => {
    setStatus("sending");
    setErrorMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: { shouldCreateUser: true },
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      const secs = extractRateLimitSeconds(error.message);
      if (secs > 0) setCooldown(secs);
      return false;
    }
    setStatus("idle");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || status === "sending") return;
    const ok = await requestCode(trimmed);
    if (ok) setStep("code");
  };

  const resendCode = async () => {
    if (status === "sending" || cooldown > 0) return;
    const trimmed = email.trim();
    if (!trimmed) return;
    setCode("");
    await requestCode(trimmed);
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = code.trim();
    if (!token || status === "verifying") return;
    setStatus("verifying");
    setErrorMsg(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
    }
    // On success, the supabase auth listener in App.tsx swaps us into the app.
  };

  const resetToEmail = () => {
    setStep("email");
    setCode("");
    setErrorMsg(null);
    setStatus("idle");
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">Cockpit</h1>
        {step === "email" ? (
          <>
            <p className="auth-subtitle">
              Enter your email — we'll send you a sign-in code.
            </p>
            <form onSubmit={sendCode} className="auth-form">
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
                disabled={status === "sending" || !email.trim() || cooldown > 0}
              >
                {status === "sending"
                  ? "Sending…"
                  : cooldown > 0
                    ? `Wait ${cooldown}s`
                    : "Send code"}
              </button>
              {errorMsg && <p className="auth-error">{errorMsg}</p>}
            </form>
          </>
        ) : (
          <>
            <p className="auth-subtitle">
              Enter the code we sent to <strong>{email}</strong>.
            </p>
            <form onSubmit={verifyCode} className="auth-form">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                autoFocus
                required
                maxLength={10}
                placeholder="Enter code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                className="auth-input auth-code"
              />
              <button
                type="submit"
                className="auth-submit"
                disabled={status === "verifying" || code.length < 6}
              >
                {status === "verifying" ? "Verifying…" : "Sign in"}
              </button>
              {errorMsg && <p className="auth-error">{errorMsg}</p>}
              <div className="auth-actions">
                <button
                  type="button"
                  onClick={resendCode}
                  className="auth-back"
                  disabled={status === "sending" || cooldown > 0}
                >
                  {status === "sending"
                    ? "Sending…"
                    : cooldown > 0
                      ? `Resend in ${cooldown}s`
                      : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={resetToEmail}
                  className="auth-back"
                >
                  Use a different email
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function extractRateLimitSeconds(msg: string): number {
  // Supabase rate-limit errors look like:
  // "For security purposes, you can only request this after 27 seconds."
  const m = msg.match(/after (\d+) seconds?/i);
  if (m) return parseInt(m[1], 10);
  return 0;
}
