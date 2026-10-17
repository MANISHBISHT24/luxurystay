"use client";

import { FormEvent, useState } from "react";

export function PasswordResetForm({ email = "", token = "" }: { email?: string; token?: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const completing = Boolean(email && token);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completing
          ? { email, token, password: form.get("password") }
          : { email: form.get("email") })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && completing) setMessage("Your password has been changed. You can now sign in.");
      else if (response.ok) setMessage("If an account exists for that address, a reset link has been sent.");
      else setMessage(data.error || "We could not complete that request.");
    } catch {
      setMessage("We could not complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <form className="form-card" onSubmit={submit}><h2>{completing ? "Choose a new password" : "Find your way back"}</h2><p>{completing ? "Choose a new password for your account." : "We will send a reset link if an account exists for that email."}</p>{completing ? <div className="form-field"><label htmlFor="reset-password">New password</label><input id="reset-password" name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} /></div> : <div className="form-field"><label htmlFor="reset-email">Email address</label><input id="reset-email" name="email" type="email" autoComplete="email" required maxLength={254} /></div>}<button className="button button-dark" disabled={busy}>{busy ? "Please wait…" : completing ? "Update password" : "Send reset link"}</button><p className="form-message" role="status">{message}</p></form>;
}
