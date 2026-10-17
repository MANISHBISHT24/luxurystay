"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateOnly } from "@/lib/hotel-time";

async function save(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "That change could not be saved.");
}

function useAdminSave() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage("Saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That change could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return { message, busy, run };
}

function roomData(form: HTMLFormElement, creating: boolean) {
  const values = new FormData(form);
  const data = {
    name: values.get("name"),
    slug: values.get("slug"),
    description: values.get("description"),
    maxGuests: Number(values.get("maxGuests")),
    bedSummary: values.get("bedSummary"),
    areaSqm: Number(values.get("areaSqm")),
    basePrice: Number(values.get("basePrice")),
    imageUrl: values.get("imageUrl"),
    featured: values.has("featured"),
    active: values.has("active")
  };
  return creating ? { ...data, inventory: Number(values.get("inventory")) } : data;
}

function RoomFields({ room, creating = false }: { room?: AdminRoom; creating?: boolean }) {
  return <>
    <div className="admin-form-grid">
      <label>Room name<input name="name" defaultValue={room?.name} required minLength={2} maxLength={100} /></label>
      {creating && <label>URL slug<input name="slug" placeholder="garden-suite" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} /></label>}
      <label>Maximum guests<input name="maxGuests" type="number" min="1" max="12" defaultValue={room?.maxGuests || 2} required /></label>
      <label>Bed summary<input name="bedSummary" defaultValue={room?.bedSummary} required /></label>
      <label>Room area (m²)<input name="areaSqm" type="number" min="8" max="2000" defaultValue={room?.areaSqm || 40} required /></label>
      <label>Base price per night (₹)<input name="basePrice" type="number" min="1" step="0.01" defaultValue={room?.basePrice} required /></label>
      <label className="wide-field">Photo URL (HTTPS)<input name="imageUrl" type="url" defaultValue={room?.imageUrl} placeholder="https://…" required /></label>
      {creating && <label>Physical rooms<input name="inventory" type="number" min="1" max="100" defaultValue="4" required /></label>}
      <label className="wide-field">Description<textarea name="description" minLength={20} maxLength={2000} defaultValue={room?.description} required /></label>
    </div>
    <div className="admin-checks"><label><input type="checkbox" name="featured" defaultChecked={room?.featured} /> Feature on homepage</label><label><input type="checkbox" name="active" defaultChecked={room?.active ?? true} /> Available to book</label></div>
  </>;
}

type AdminRoom = {
  id: string; name: string; slug: string; description: string; maxGuests: number; bedSummary: string;
  areaSqm: number; basePrice: number; imageUrl: string; featured: boolean; active: boolean; inventory: number;
  seasonalRates: { id: string; startsOn: string; endsOn: string; nightlyRate: number }[];
};

export function AdminRoomManager({ rooms }: { rooms: AdminRoom[] }) {
  const state = useAdminSave();
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    state.run(async () => {
      await save("/api/admin/rooms", "POST", roomData(form, true));
      form.reset();
    });
  }
  return <div className="admin-stack"><form className="admin-form" onSubmit={create}><h2>Add room type</h2><RoomFields creating /><button className="button button-dark" disabled={state.busy}>{state.busy ? "Saving…" : "Add room type"}</button><p className="form-message" role="status">{state.message}</p></form><div className="admin-room-list">{rooms.map((room) => <RoomEditor key={room.id} room={room} />)}{rooms.length === 0 && <p className="admin-empty">No room types have been created.</p>}</div></div>;
}

function RoomEditor({ room }: { room: AdminRoom }) {
  const state = useAdminSave();
  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    state.run(() => save("/api/admin/rooms/" + room.id, "PATCH", roomData(form, false)));
  }
  function addRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    state.run(async () => {
      await save("/api/admin/rooms/" + room.id + "/pricing", "POST", {
        startsOn: values.get("startsOn"), endsOn: values.get("endsOn"), nightlyRate: Number(values.get("nightlyRate"))
      });
      form.reset();
    });
  }
  return <details className="admin-room-editor"><summary><span>{room.name}</span><small>{room.inventory} rooms · {room.active ? "Bookable" : "Hidden"}</small></summary><form className="admin-form" onSubmit={update}><RoomFields room={room} /><button className="button button-dark" disabled={state.busy}>Save room</button></form><form className="season-rate-form" onSubmit={addRate}><strong>Seasonal rates</strong><div className="admin-form-grid"><label>Starts on<input name="startsOn" type="date" required /></label><label>Ends before<input name="endsOn" type="date" required /></label><label>Nightly price (₹)<input name="nightlyRate" type="number" min="1" step="0.01" required /></label></div><button className="button button-gold" disabled={state.busy}>Add seasonal rate</button></form>{room.seasonalRates.map((rate) => <p className="admin-meta" key={rate.id}>{formatDateOnly(new Date(rate.startsOn))} – {formatDateOnly(new Date(rate.endsOn))} · ₹{rate.nightlyRate.toLocaleString("en-IN")} / night</p>)}<p className="form-message" role="status">{state.message}</p></details>;
}

export function AdminOfferManager({ offers }: { offers: { id: string; code: string; kind: string; value: number; active: boolean; uses: number; maxUses: number | null; endsAt: string | null }[] }) {
  const state = useAdminSave();
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    state.run(async () => {
      await save("/api/admin/offers", "POST", {
        code: values.get("code"), kind: values.get("kind"), value: Number(values.get("value")),
        startsAt: values.get("startsAt"), endsAt: values.get("endsAt"),
        maxUses: values.get("maxUses") ? Number(values.get("maxUses")) : undefined
      });
      form.reset();
    });
  }
  return <div className="admin-stack"><form className="admin-form" onSubmit={create}><h2>Create an offer</h2><div className="admin-form-grid"><label>Code<input name="code" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]+" /></label><label>Discount type<select name="kind"><option value="PERCENT">Percentage</option><option value="FIXED">Fixed amount</option></select></label><label>Discount value<input name="value" type="number" min="0.01" step="0.01" required /></label><label>Maximum uses<input name="maxUses" type="number" min="1" /></label><label>Starts on<input name="startsAt" type="datetime-local" /></label><label>Ends on<input name="endsAt" type="datetime-local" /></label></div><button className="button button-dark" disabled={state.busy}>Create offer</button><p className="form-message" role="status">{state.message}</p></form><div className="admin-list">{offers.map((offer) => <OfferRow key={offer.id} offer={offer} />)}{offers.length === 0 && <p className="admin-empty">No offers yet.</p>}</div></div>;
}

function OfferRow({ offer }: { offer: { id: string; code: string; kind: string; value: number; active: boolean; uses: number; maxUses: number | null; endsAt: string | null } }) {
  const state = useAdminSave();
  return <div className="admin-list-row"><div><strong>{offer.code}</strong><small>{offer.kind === "PERCENT" ? offer.value + "% off" : "₹" + offer.value.toLocaleString("en-IN") + " off"} · {offer.uses}{offer.maxUses ? "/" + offer.maxUses : ""} uses</small></div><button className="admin-toggle" disabled={state.busy} onClick={() => state.run(() => save("/api/admin/offers/" + offer.id, "PATCH", { active: !offer.active }))}>{offer.active ? "Pause offer" : "Activate offer"}</button></div>;
}

export function AdminBookingActions({ id, status }: { id: string; status: string }) {
  const state = useAdminSave();
  if (status !== "PENDING" && status !== "CONFIRMED") return <span className="status-pill">{status}</span>;
  return <div><button className="admin-toggle" disabled={state.busy} onClick={() => state.run(() => save("/api/admin/bookings/" + id + "/cancel", "POST", {}))}>Cancel booking</button><p className="form-message" role="status">{state.message}</p></div>;
}

export function AdminMessageAction({ id, readAt }: { id: string; readAt: string | null }) {
  const state = useAdminSave();
  return readAt ? <span className="status-pill">Read</span> : <button className="admin-toggle" disabled={state.busy} onClick={() => state.run(() => save("/api/admin/messages/" + id, "PATCH", {}))}>Mark read</button>;
}

export function CustomerBookingAction({ reference, status }: { reference: string; status: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (status !== "PENDING" && status !== "CONFIRMED") return null;
  async function cancel() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/bookings/" + reference + "/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Cancellation could not be completed.");
      setMessage(data.refundStatus === "NOT_REQUIRED" ? "Cancelled." : "Cancelled · refund " + data.refundStatus.toLowerCase().replaceAll("_", " ") + ".");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cancellation could not be completed.");
    } finally {
      setBusy(false);
    }
  }
  return <div><button className="admin-toggle" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : "Cancel stay"}</button><p className="form-message" role="status">{message}</p></div>;
}
