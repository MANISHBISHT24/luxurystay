"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      if (registering) {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(form))
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage(data.error || "We could not create your account.");
          setBusy(false);
          return;
        }
        if (data.verificationRequired) {
          setMessage("Please check your email to verify your account.");
          setBusy(false);
          return;
        }
      }
      const result = await signIn("credentials", {
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        redirect: false
      });
      if (result?.error) {
        setMessage("We could not sign you in. Check your details and try again.");
        setBusy(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setMessage("We could not complete that request. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <h2>{registering ? "Make yourself at home" : "Welcome back"}</h2>
      <p>{registering ? "Create an account to keep your stays close." : "Sign in to view and manage your stays."}</p>
      {registering && <div className="form-field"><label htmlFor="auth-name">Full name</label><input id="auth-name" name="name" autoComplete="name" required minLength={2} maxLength={100} /></div>}
      <div className="form-field"><label htmlFor="auth-email">Email address</label><input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254} /></div>
      <div className="form-field"><label htmlFor="auth-password">Password</label><input id="auth-password" name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 10 : 1} maxLength={128} /></div>
      <button className="button button-dark" disabled={busy}>{busy ? "Please wait…" : registering ? "Create account" : "Sign in"}</button>
      <p className="form-message" role="status">{message}</p>
      <p className="form-switch">{registering ? <>Already have an account? <Link className="text-link" href="/login">Sign in</Link></> : <>New to LuxuryStay? <Link className="text-link" href="/register">Create an account</Link></>}</p>
      {!registering && <p className="form-switch"><Link className="text-link" href="/password-reset">Forgot your password?</Link></p>}
    </form>
  );
}
