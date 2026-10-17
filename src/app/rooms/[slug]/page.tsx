import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingSearch } from "@/components/booking-search";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const room = await prisma.roomType.findUnique({ where: { slug, active: true }, select: { name: true, description: true } }).catch(() => null);
  return room ? { title: room.name, description: room.description } : { title: "Room details" };
}

export default async function RoomDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = await prisma.roomType.findUnique({
    where: { slug, active: true },
    include: { amenities: { include: { amenity: true } } }
  }).catch(() => null);
  if (!room) notFound();
  return (
    <>
      <section className="room-detail">
        <div className="room-detail-image"><Image src={room.imageUrl} alt={room.name} fill priority unoptimized sizes="(max-width: 760px) 100vw, 55vw" /></div>
        <div className="room-detail-copy"><p className="eyebrow">A place to exhale</p><h1>{room.name}</h1><p>{room.description}</p><div className="room-detail-facts"><span>{room.areaSqm} m²</span><span>{room.bedSummary}</span><span>Up to {room.maxGuests} guests</span></div><p>From ₹{room.basePrice.toNumber().toLocaleString("en-IN")} per night, before seasonal pricing.</p><Link className="button button-dark" href={"/booking?roomType=" + room.slug}>Check dates &amp; reserve</Link></div>
      </section>
      {room.amenities.length > 0 && <section className="section"><h2 className="page-title">Thoughtful details</h2><div className="content-tiles">{room.amenities.map(({ amenity }) => <article className="content-tile" key={amenity.id}><h3>{amenity.name}</h3><p>{amenity.description}</p></article>)}</div></section>}
      <section className="rooms-search-section"><p className="eyebrow">Plan your visit</p><h2 className="section-title-small">When would you like to arrive?</h2><BookingSearch action="/booking" roomType={room.slug} /></section>
    </>
  );
}
