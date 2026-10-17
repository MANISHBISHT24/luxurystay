import Image from "next/image";
import Link from "next/link";

type RoomCardData = {
  slug: string;
  name: string;
  description: string;
  maxGuests: number;
  bedSummary: string;
  areaSqm: number;
  basePrice: { toNumber(): number } | number;
  imageUrl: string;
};

export function RoomCard({ room, quote, bookingHref }: {
  room: RoomCardData;
  quote?: { nights: number; total: number };
  bookingHref?: string;
}) {
  const price = typeof room.basePrice === "number" ? room.basePrice : room.basePrice.toNumber();
  return (
    <article className="room-card">
      <Link className="room-card-image" href={"/rooms/" + room.slug}>
        <Image src={room.imageUrl} alt={room.name} width={900} height={650} unoptimized />
        <span className="room-card-arrow" aria-hidden="true">↗</span>
      </Link>
      <div className="room-card-body">
        <div className="room-card-title">
          <h3><Link href={"/rooms/" + room.slug}>{room.name}</Link></h3>
          <span>{quote ? "Stay total ₹" + quote.total.toLocaleString("en-IN") : "From ₹" + price.toLocaleString("en-IN") + " / night"}</span>
        </div>
        <p>{room.description}</p>
        <div className="room-meta"><span>{room.areaSqm} m²</span><span>{room.bedSummary}</span><span>{quote ? quote.nights + " nights" : "Up to " + room.maxGuests + " guests"}</span></div>
        {bookingHref && <Link className="arrow-link room-book-link" href={bookingHref}>Choose this stay <span aria-hidden="true">↗</span></Link>}
      </div>
    </article>
  );
}
