# bemyguest

Guest site for a two-day Goa wedding: Google sign-in, save-the-date with calendar
links, the schedule, a chat-style RSVP, a guest wall of notes, a guest profile,
and a private dashboard for the couple.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Google auth) · Vercel.

→ **To launch it, follow [SETUP.md](./SETUP.md).**

## Run it locally

```bash
npm install
npm run dev     # http://localhost:3000
```

Without Supabase keys it runs in **demo mode** with sample data (see SETUP.md §0).

## Where things live

| What | Where |
| --- | --- |
| Names, dates, venues, times, copy for events | `src/content/wedding.ts` |
| Stay and Getting there pages (resort, rooms, packing list, airports, trains) | `src/content/venue.ts` |
| Colours, fonts, buttons, animations | `src/app/globals.css` |
| Pages | `src/app/(guest)/…` (home, schedule, rsvp, wall, profile, stay, travel, gallery) |
| Sign-in page | `src/app/login/` |
| Couple's dashboard + CSV export | `src/app/admin/` |
| Database tables & security rules | `supabase/schema.sql` |
| Data access (Supabase or demo) | `src/lib/data.ts` |
| Calendar links & `.ics` files | `src/lib/calendar.ts`, `src/app/calendar/[event]/route.ts` |
| Illustrations | `public/illustrations/` |

## Useful commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```
