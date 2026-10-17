import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { queryOr } from "@/lib/db-query";

export async function SiteFooter() {
  const settings = await queryOr(() => prisma.hotelSetting.findUnique({ where: { id: 1 } }), null);
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <Link className="brand brand-light" href="/">
            <span className="brand-mark">L</span>
            <span className="brand-name">LUXURYSTAY<small>HOTEL &amp; RESORT</small></span>
          </Link>
          <p>A quieter kind of luxury, shaped by thoughtful hospitality and a sense of place.</p>
        </div>
        <div className="footer-column">
          <p className="footer-label">Discover</p>
          <Link href="/rooms">Rooms &amp; suites</Link>
          <Link href="/amenities">The amenities</Link>
          <Link href="/dining">Dining</Link>
          <Link href="/experiences">Experiences</Link>
        </div>
        <div className="footer-column">
          <p className="footer-label">Your stay</p>
          <Link href="/offers">Special offers</Link>
          <Link href="/contact">Contact us</Link>
          <Link href="/faq">FAQs</Link>
          <Link href="/my-bookings">Manage booking</Link>
        </div>
        <div className="footer-column footer-contact">
          <p className="footer-label">Come away</p>
          <span>{settings?.address || "Address shared with confirmed guests"}</span>
          {settings?.contactEmail ? <a href={"mailto:" + settings.contactEmail}>{settings.contactEmail}</a> : <Link href="/contact">Use our contact form</Link>}
          {settings?.contactPhone ? <a href={"tel:" + settings.contactPhone}>{settings.contactPhone}</a> : null}
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} LuxuryStay. All rights reserved.</span>
        <div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></div>
        <span className="footer-note">A place to arrive, and exhale.</span>
      </div>
    </footer>
  );
}
