export function BookingSearch({
  checkIn,
  checkOut,
  guests = 2,
  rooms = 1,
  action = "/rooms",
  roomType
}: {
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  rooms?: number;
  action?: string;
  roomType?: string;
}) {
  return (
    <form className="booking-search" action={action}>
      {roomType && <input type="hidden" name="roomType" value={roomType} />}
      <label>
        <span>Check in</span>
        <input aria-label="Check-in date" type="date" name="checkIn" defaultValue={checkIn} required />
      </label>
      <label>
        <span>Check out</span>
        <input aria-label="Check-out date" type="date" name="checkOut" defaultValue={checkOut} required />
      </label>
      <label>
        <span>Guests</span>
        <select aria-label="Number of guests" name="guests" defaultValue={String(guests)}>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? "guest" : "guests"}</option>)}
        </select>
      </label>
      <label>
        <span>Rooms</span>
        <select aria-label="Number of rooms" name="rooms" defaultValue={String(rooms)}>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} {n === 1 ? "room" : "rooms"}</option>)}
        </select>
      </label>
      <button className="button button-gold" type="submit">Find your stay <span aria-hidden="true">↗</span></button>
    </form>
  );
}
