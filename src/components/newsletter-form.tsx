"use client";

import { FormEvent, useState } from "react";

export function NewsletterForm() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    const email = new FormData(formElement).get("email");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (response.ok) {
        formElement.reset();
        setMessage("You are on the list. Thank you.");
      } else {
        setMessage("We could not add you just now. Please try again.");
      }
    } catch {
      setMessage("We could not add you just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return <><form onSubmit={submit}><label className="sr-only" htmlFor="newsletter-email">Email address</label><input id="newsletter-email" name="email" type="email" placeholder="Your email address" required maxLength={254} /><button type="submit" disabled={busy}>{busy ? "Joining…" : "Join us"} <span aria-hidden="true">↗</span></button></form><small role="status">{message || "Occasional notes, thoughtfully sent. Unsubscribe whenever you like."}</small></>;
}
