const defaultTimezone = () => process.env.HOTEL_TIMEZONE || "Asia/Kolkata";

export function hotelDate(now = new Date(), timezone = defaultTimezone()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now).map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day;
}

export function formatDateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function hotelMidnight(date: Date, timezone = defaultTimezone()) {
  const dateText = date.toISOString().slice(0, 10);
  const [year, month, day] = dateText.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day);
  const localParts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date(utcGuess)).map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(Number(localParts.year), Number(localParts.month) - 1, Number(localParts.day), Number(localParts.hour), Number(localParts.minute), Number(localParts.second));
  return new Date(utcGuess - (localAsUtc - utcGuess));
}
