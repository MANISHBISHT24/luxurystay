"use client";

import Script from "next/script";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void };
  }
}

type BookingFormProps = {
  roomType: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  roomCount: number;
  paymentEnabled: boolean;
  nonce?: string;
};

export function BookingForm(props: BookingFormProps) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scriptReady, setScriptReady] = useState(!props.paymentEnabled);
  const requestKey = useRef({ fingerprint: "", value: "" });
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form);
    const fingerprint = JSON.stringify(payload);
    if (requestKey.current.fingerprint !== fingerprint) {
      requestKey.current = { fingerprint, value: crypto.randomUUID() };
    }
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": requestKey.current.value },
        body: fingerprint
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.error || "Those dates are no longer available. Please choose another stay.");
        return;
      }
      if (!props.paymentEnabled || !data.payment?.key || !data.payment?.orderId) {
        setMessage("Your room is held for 15 minutes. Online payment is not configured yet, so no booking has been confirmed.");
        return;
      }
      if (!window.Razorpay) {
        setMessage("Secure checkout is still loading. Your room is held briefly; please try again.");
        return;
      }
      const checkout = new window.Razorpay({
      key: data.payment.key,
      order_id: data.payment.orderId,
      amount: data.payment.amount,
      currency: data.payment.currency,
      name: "LuxuryStay",
      description: props.roomName,
      prefill: {
        name: String(form.get("fullName") || ""),
        email: String(form.get("email") || ""),
        contact: String(form.get("phone") || "")
      },
      theme: { color: "#8e7546" },
      handler: async (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const verified = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(result)
        });
        if (verified.ok) router.push("/booking/confirmation/" + data.booking.reference);
        else setMessage("Payment was received, but confirmation is still processing. Please contact the resort with reference " + data.booking.reference + ".");
      },
      modal: {
        ondismiss: () => setMessage("Checkout closed. Your room is held for a short time while payment completes.")
      }
      });
      checkout.open();
    } catch {
      setMessage("We could not reach the booking service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {props.paymentEnabled && <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" nonce={props.nonce} onReady={() => setScriptReady(true)} />}
      <form className="form-card booking-form-card" onSubmit={submit}>
        <h2>Your details</h2>
        <p>We will hold your selected room while you complete payment.</p>
        <input type="hidden" name="roomType" value={props.roomType} />
        <input type="hidden" name="checkIn" value={props.checkIn} />
        <input type="hidden" name="checkOut" value={props.checkOut} />
        <input type="hidden" name="adults" value={props.guests} />
        <input type="hidden" name="children" value="0" />
        <input type="hidden" name="roomCount" value={props.roomCount} />
        <div className="form-field"><label htmlFor="guest-name">Full name</label><input id="guest-name" name="fullName" autoComplete="name" required minLength={2} maxLength={100} /></div>
        <div className="form-field"><label htmlFor="guest-email">Email address</label><input id="guest-email" name="email" type="email" autoComplete="email" required maxLength={254} /></div>
        <div className="form-field"><label htmlFor="guest-phone">Phone (optional)</label><input id="guest-phone" name="phone" type="tel" autoComplete="tel" maxLength={30} /></div>
        <div className="form-field"><label htmlFor="booking-coupon">Offer code (optional)</label><input id="booking-coupon" name="couponCode" autoCapitalize="characters" maxLength={40} /></div>
        <button className="button button-dark" disabled={busy || (props.paymentEnabled && !scriptReady)}>{busy ? "Securing your stay…" : props.paymentEnabled && !scriptReady ? "Loading secure checkout…" : "Continue to secure payment"}</button>
        <p className="form-message" role="status">{message}</p>
      </form>
    </>
  );
}
