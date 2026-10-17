"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSending(true);
    setMessage("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form))
      });
      if (response.ok) {
        formElement.reset();
        setMessage("Thank you. Our team will be in touch shortly.");
      } else {
        setMessage("We could not send your message. Please try again.");
      }
    } catch {
      setMessage("We could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <h2>Write to us</h2>
      <p>For reservations, special requests or a little more information.</p>
      <div className="form-grid">
        <div className="form-field"><label htmlFor="contact-name">Your name</label><input id="contact-name" name="name" autoComplete="name" required maxLength={100} /></div>
        <div className="form-field"><label htmlFor="contact-email">Email address</label><input id="contact-email" name="email" type="email" autoComplete="email" required maxLength={254} /></div>
      </div>
      <div className="form-field"><label htmlFor="contact-subject">Subject</label><input id="contact-subject" name="subject" required maxLength={120} /></div>
      <div className="form-field"><label htmlFor="contact-message">How can we help?</label><textarea id="contact-message" name="message" required maxLength={3000} /></div>
      <button className="button button-dark" disabled={sending}>{sending ? "Sending…" : "Send your note"}</button>
      <p className="form-message" role="status">{message}</p>
    </form>
  );
}
