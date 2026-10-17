import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AuthForm } from "@/components/auth-form";
import { ContactForm } from "@/components/contact-form";
import { SectionHeading } from "@/components/section-heading";
import { siteContent } from "@/lib/site-content";
import { prisma } from "@/lib/prisma";
import { queryOr } from "@/lib/db-query";
import { auth } from "@/auth";
import { PasswordResetForm } from "@/components/password-reset-form";
import { CustomerBookingAction } from "@/components/admin-controls";
import { formatDateOnly } from "@/lib/hotel-time";

const specialSlugs = ["about", "amenities", "dining", "experiences", "faq", "privacy", "terms", "contact", "login", "register", "dashboard", "my-bookings", "offers", "gallery", "password-reset"];

export function generateStaticParams() {
  return specialSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = siteContent[slug];
  return content ? { title: content.title, description: content.copy } : { title: "LuxuryStay" };
}

export default async function ContentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  if (!specialSlugs.includes(slug)) notFound();
  if (slug === "login" || slug === "register") {
    return <section className="form-page"><div className="content-hero"><p className="eyebrow">{slug === "login" ? "Your stays, together" : "A place to return to"}</p><h1>{slug === "login" ? "Welcome back." : "Make yourself at home."}</h1></div><AuthForm mode={slug} /></section>;
  }
  if (slug === "password-reset") {
    return <section className="form-page"><div className="content-hero"><p className="eyebrow">Account access</p><h1>Reset your password.</h1></div><PasswordResetForm email={typeof query.email === "string" ? query.email : ""} token={typeof query.token === "string" ? query.token : ""} /></section>;
  }
  if (slug === "contact") {
    const settings = await queryOr(() => prisma.hotelSetting.findUnique({ where: { id: 1 } }), null);
    return <><section className="content-hero"><p className="eyebrow">We are here for you</p><h1>Let us help you plan.</h1><p>Tell us what you have in mind. Our team will be glad to help.</p></section><section className="form-page"><div className="content-tiles"><div className="content-tile"><h3>Call us</h3><p>{settings?.contactPhone || "Send us a note using the form below."}</p></div><div className="content-tile"><h3>Write to us</h3><p>{settings?.contactEmail || "Send us a note using the form below."}</p></div><div className="content-tile"><h3>Find us</h3><p>{settings?.address || "Our address will be shared with confirmed guests."}</p></div></div><ContactForm /></section></>;
  }
  if (slug === "dashboard" || slug === "my-bookings") {
    const session = await auth();
    if (!session?.user?.id) redirect("/login");
    const bookings = await queryOr(() => prisma.booking.findMany({
      where: { userId: session.user.id },
      include: { roomType: true, guests: { where: { isPrimary: true }, take: 1 } },
      orderBy: { createdAt: "desc" },
      take: 20
    }), []);
    return <section className="form-page"><p className="eyebrow">Your account</p><h1 className="page-title">{slug === "dashboard" ? "A little space of your own." : "Your stays."}</h1><p className="section-copy">Welcome back{session.user.name ? ", " + session.user.name : ""}. Here you can see your recent reservations.</p><div className="account-bookings">{bookings.length ? bookings.map((booking) => <article className="booking-row" key={booking.id}><div><span className="eyebrow">{booking.status}</span><h2>{booking.roomType.name}</h2><p>{formatDateOnly(booking.checkIn)} — {formatDateOnly(booking.checkOut)} · Ref {booking.reference}</p></div><strong>₹{booking.total.toNumber().toLocaleString("en-IN")}</strong><Link className="arrow-link" href={"/booking/confirmation/" + booking.reference}>View stay ↗</Link><CustomerBookingAction reference={booking.reference} status={booking.status} /></article>) : <div className="empty-state"><p>Your reservations will appear here once you book a stay while signed in.</p><Link className="text-link" href="/rooms">Explore our rooms ↗</Link></div>}</div></section>;
  }
  if (slug === "offers") {
    const now = new Date();
    const coupons = await queryOr(() => prisma.coupon.findMany({ where: { active: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] }, orderBy: { endsAt: "asc" } }), []);
    const tiles = coupons.filter((coupon) => coupon.maxUses === null || coupon.uses < coupon.maxUses).map((coupon) => ({ title: coupon.code, copy: coupon.kind === "PERCENT" ? coupon.value.toString() + "% off your stay. Enter this code during checkout." : "₹" + coupon.value.toNumber().toLocaleString("en-IN") + " off your stay. Enter this code during checkout." }));
    return <ContentTemplate slug="offers" tiles={tiles.length ? tiles : [{ title: "No active offers", copy: "There are no active online offers at the moment. Please check back soon." }]} />;
  }
  if (slug === "gallery") {
    const rooms = await queryOr(() => prisma.roomType.findMany({ where: { active: true }, select: { id: true, name: true, imageUrl: true } }), []);
    return <ContentTemplate slug="gallery"><div className="gallery-grid">{rooms.length ? rooms.map((room) => <figure key={room.id}><Image src={room.imageUrl} alt={room.name} width={1000} height={700} unoptimized /><figcaption>{room.name}</figcaption></figure>) : <p className="empty-inline">Resort photography is being prepared.</p>}</div></ContentTemplate>;
  }
  const content = siteContent[slug];
  if (!content) notFound();
  let tiles = content.tiles;
  if (slug === "amenities") {
    const amenities = await queryOr(() => prisma.amenity.findMany({ orderBy: { name: "asc" } }), []);
    if (amenities.length) tiles = amenities.map((item) => ({ title: item.name, copy: item.description }));
  }
  return <ContentTemplate slug={slug} tiles={tiles} />;
}

function ContentTemplate({ slug, children, tiles }: { slug: string; children?: React.ReactNode; tiles?: { title: string; copy: string }[] }) {
  const content = siteContent[slug];
  const visibleTiles = tiles ?? content.tiles;
  return <><section className="content-hero"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}</h1><p>{content.copy}</p></section><section className="content-body"><SectionHeading eyebrow={content.eyebrow} title={content.heading} /><p>{content.body}</p>{visibleTiles && visibleTiles.length > 0 && <div className="content-tiles">{visibleTiles.map((tile, index) => <article className="content-tile" key={tile.title}><span className="amenity-number">0{index + 1}</span><h3>{tile.title}</h3><p>{tile.copy}</p></article>)}</div>}{children}</section></>;
}
