import { prisma } from "@/lib/prisma";
import { AdminOfferManager } from "@/components/admin-controls";

export default async function AdminOffersPage() {
  const stored = await prisma.coupon.findMany({ orderBy: { code: "asc" } });
  const offers = stored.map((offer) => ({
    ...offer,
    value: offer.value.toNumber(),
    endsAt: offer.endsAt?.toISOString() || null
  }));
  return <section className="admin-page"><p className="eyebrow">Offers &amp; packages</p><h1 className="page-title">Special offers</h1><p className="section-copy">Create discount codes for the booking flow. Offers are checked again on the server before a reservation is held.</p><AdminOfferManager offers={offers} /></section>;
}
