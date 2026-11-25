/**
 * Small formatters for RSVP answers, shared by the RSVP (in the browser), My
 * profile and the couple's dashboard (on the server). Deterministic, so the
 * server and the phone print the same thing.
 */

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2027-01-30" → "Sat 30 Jan" (same on server and phone). */
export function fmtDay(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()} ${MO[d.getUTCMonth()]}`;
}

/** Country codes offered next to the WhatsApp number (code first, so it's what shows in a narrow box). */
export const CODES: [string, string][] = [
  ["+91", "+91 India"],
  ["+971", "+971 UAE"],
  ["+44", "+44 UK"],
  ["+1", "+1 US / Canada"],
  ["+65", "+65 Singapore"],
  ["+61", "+61 Australia"],
];

/** "+919876543210" → ["+91", "9876543210"]; unknown codes → ["other", "+..."]. */
export function splitPhone(e164: string): [string, string] {
  if (!e164) return ["+91", ""];
  const code = [...CODES].sort((a, b) => b[0].length - a[0].length).find(([c]) => e164.startsWith(c));
  return code ? [code[0], e164.slice(code[0].length)] : ["other", e164];
}

export function joinPhone(code: string, number: string) {
  const digits = number.replace(/[^\d+]/g, "");
  return code === "other" ? digits : `${code}${digits.replace(/^\+/, "").replace(/^0+/, "")}`;
}

/** "+919876543210" → "+91 98765 43210". */
export function fmtPhone(e164: string) {
  const [code, rest] = splitPhone(e164);
  if (code === "other") return e164;
  if (code === "+91" && rest.length === 10) return `+91 ${rest.slice(0, 5)} ${rest.slice(5)}`;
  return `${code} ${rest}`;
}

