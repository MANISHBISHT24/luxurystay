"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function AdminSettingsForm({ settings }: {
  settings: {
    name: string; currency: string; timezone: string; taxPercent: number; cancellationHours: number;
    contactEmail: string; contactPhone: string; address: string;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function update(form: HTMLFormElement) {
    const values = new FormData(form);
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      name: values.get("name"), currency: values.get("currency"), timezone: values.get("timezone"),
      taxPercent: Number(values.get("taxPercent")), cancellationHours: Number(values.get("cancellationHours")),
      contactEmail: values.get("contactEmail"), contactPhone: values.get("contactPhone"), address: values.get("address")
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Settings could not be saved.");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage("");
    try {
      await update(form);
      setMessage("Saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return <form className="admin-form" onSubmit={submit}><div className="admin-form-grid"><label>Hotel name<input name="name" defaultValue={settings.name} required maxLength={120} /></label><label>Currency<select name="currency" defaultValue={settings.currency}><option value="INR">INR · Indian rupee</option></select></label><label>Time zone<input name="timezone" defaultValue={settings.timezone} required /></label><label>Tax (%)<input name="taxPercent" type="number" min="0" max="50" step="0.01" defaultValue={settings.taxPercent} required /></label><label>Free-cancellation window (hours)<input name="cancellationHours" type="number" min="0" max="720" defaultValue={settings.cancellationHours} required /></label><label>Contact email<input name="contactEmail" type="email" defaultValue={settings.contactEmail} /></label><label>Contact phone<input name="contactPhone" defaultValue={settings.contactPhone} maxLength={40} /></label><label className="wide-field">Resort address<textarea name="address" defaultValue={settings.address} maxLength={500} /></label></div><button className="button button-dark" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button><p className="form-message" role="status">{message}</p></form>;
}
