import Image from "next/image";
import Link from "next/link";
import { BookingSearch } from "@/components/booking-search";
import { RoomCard } from "@/components/room-card";
import { SectionHeading } from "@/components/section-heading";
import { prisma } from "@/lib/prisma";
import { queryOr } from "@/lib/db-query";
import { NewsletterForm } from "@/components/newsletter-form";

const heroImage = "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=2400&q=88";

export default async function HomePage() {
  const [rooms, amenities, reviews, settings] = await Promise.all([
    queryOr(() => prisma.roomType.findMany({ where: { active: true, featured: true }, take: 3, orderBy: { basePrice: "asc" } }), []),
    queryOr(() => prisma.amenity.findMany({ take: 4, orderBy: { name: "asc" } }), []),
    queryOr(() => prisma.review.findMany({ where: { published: true, verified: true }, take: 3, orderBy: { createdAt: "desc" } }), []),
    queryOr(() => prisma.hotelSetting.findUnique({ where: { id: 1 } }), null)
  ]);

  return (
    <>
      <section className="hero">
        <Image className="hero-image" src={heroImage} alt="Quiet pool beside a palm-lined resort at dusk" fill priority unoptimized sizes="100vw" />
        <div className="hero-shade"></div>
        <div className="hero-content">
          <p className="eyebrow eyebrow-light">A private hideaway in India</p>
          <h1>Find your<br /><em>still point.</em></h1>
          <p className="hero-copy">Thoughtful hospitality, a softer pace, and room to feel entirely elsewhere.</p>
          <Link className="hero-link" href="/about">Discover LuxuryStay <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="hero-caption"><span>01 — THE ART OF ARRIVING</span><span>EST. WITH INTENTION</span></div>
      </section>

      <section className="booking-wrap" aria-label="Plan your stay">
        <div className="booking-intro"><p className="eyebrow">Make room for rest</p><h2>Your stay begins here.</h2></div>
        <BookingSearch />
      </section>

      <section className="section section-rooms">
        <div className="section-topline">
          <SectionHeading eyebrow="Stay a little longer" title="Spaces to settle into" copy="Each room is a considered retreat, with natural textures, generous light and the details already taken care of." />
          <Link className="arrow-link" href="/rooms">Explore all stays <span aria-hidden="true">↗</span></Link>
        </div>
        {rooms.length > 0 ? (
          <div className="room-grid">{rooms.map((room) => <RoomCard key={room.id} room={room} />)}</div>
        ) : (
          <div className="empty-state"><p>Our rooms are being prepared for online reservations.</p><Link className="text-link" href="/contact">Speak with our team ↗</Link></div>
        )}
      </section>

      <section className="interlude">
        <div className="interlude-image">
          <Image src="https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=1600&q=85" alt="Warmly lit resort lounge opening onto a garden" width={1200} height={900} unoptimized />
        </div>
        <div className="interlude-copy">
          <p className="eyebrow">A feeling, not a schedule</p>
          <h2>Take the long way<br />back to yourself.</h2>
          <p>Start the morning slowly. Let lunch become an occasion. Find a quiet corner that seems to have been waiting for you.</p>
          <Link className="arrow-link" href="/experiences">Explore the feeling <span aria-hidden="true">↗</span></Link>
        </div>
      </section>

      <section className="section amenities-section">
        <SectionHeading eyebrow="The thoughtful details" title="Everything in its own time" copy="Space to move, pause and reconnect—guided by what feels right to you." centered />
        <div className="amenity-grid">
          {(amenities.length ? amenities : []).map((amenity) => (
            <article className="amenity-item" key={amenity.id}><span className="amenity-number">0{amenities.indexOf(amenity) + 1}</span><h3>{amenity.name}</h3><p>{amenity.description}</p></article>
          ))}
          {amenities.length === 0 && <p className="empty-inline">Our resort amenities will be shared here soon.</p>}
        </div>
        <Link className="arrow-link" href="/amenities">Explore the resort <span aria-hidden="true">↗</span></Link>
      </section>

      <section className="quote-section">
        <p className="eyebrow eyebrow-light">The guest book</p>
        {reviews.length ? (
          <div className="review-grid">{reviews.map((review) => <blockquote key={review.id}><span className="stars" aria-label={review.rating + " out of 5 stars"}>★★★★★</span><p>“{review.quote}”</p><cite>{review.guestName}<small>Verified guest</small></cite></blockquote>)}</div>
        ) : (
          <div className="review-pending"><h2>Stories from your stay,<br /><em>when they are yours to tell.</em></h2><p>Guest testimonials will appear here after they have been verified.</p></div>
        )}
      </section>

      <section className="location-section">
        <div className="location-copy">
          <p className="eyebrow">A world away, just within reach</p>
          <h2>Somewhere<br /><em>worth finding.</em></h2>
          <p>Discover a tucked-away address in India, where the landscape sets the pace and every arrival feels personal.</p>
          {settings?.address && <address className="location-address">{settings.address}</address>}
          <Link className="arrow-link" href="/contact">Plan your journey <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="location-image">
          <Image src="https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1400&q=85" alt="A tranquil mountain retreat surrounded by forest" width={1000} height={780} unoptimized />
          <span className="image-stamp">A PLACE<br />TO EXHALE</span>
        </div>
      </section>

      <section className="newsletter-section">
        <div><p className="eyebrow">A note from the resort</p><h2>A little more room<br />for the good things.</h2></div>
        <div className="newsletter-copy"><p>Be the first to hear about considered escapes, seasonal menus and moments worth making time for.</p><NewsletterForm /></div>
      </section>
    </>
  );
}
