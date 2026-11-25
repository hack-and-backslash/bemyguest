# Going live — step by step

About 30–40 minutes, all free. Do the steps in order; each one gives you a value
the next step needs. Keep a scratch note open to paste things into.

> **Never paste secret keys into a chat or commit them to GitHub.** They only go
> into `.env.local` on your Mac and into Vercel's settings.

---

## 0. Try it on your Mac first (demo mode)

You need Node.js 20.9 or newer (`node -v`).

```bash
cd ~/develop/bemyguest
npm install
npm run dev
```

Open http://localhost:3000. With no Supabase keys the site runs in **demo mode**:
"Continue with Google" signs you in as *Sam* with sample guests and notes. Nothing
is saved; restarting resets it. You're also treated as an admin, so `/admin` works.

## 1. Fill in your details

Edit **`src/content/wedding.ts`**: names, monogram, venues, addresses, the two
dates, event times (with the `+05:30` IST offset), Google Maps links, RSVP
deadline and a contact line. Anything left as `null` shows a `[placeholder]` and
keeps its calendar button switched off.

The Stay and Getting there pages read from **`src/content/venue.ts`**: the resort
blurbs, what's in the rooms, good-to-knows, the packing list, airports and trains.

## 2. Supabase (database + sign-in)

1. Sign up at https://supabase.com → **New project**. Pick a region near India
   (e.g. Mumbai) and save the database password somewhere safe.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   You should see "Success". (It's safe to run again later.)
3. **Project Settings → API Keys**: copy the **Project URL**, the
   **publishable key** (`sb_publishable_…`) and a **secret key** (`sb_secret_…`).
4. **Authentication → Sign In / Providers → Google**: switch it on and keep this
   page open. Copy the **Callback URL** it shows
   (`https://<your-ref>.supabase.co/auth/v1/callback`) — you need it in step 3.

## 3. Google Cloud (the "Continue with Google" button)

1. Go to https://console.cloud.google.com → create a project (e.g. "bemyguest").
2. **Google Auth Platform → Branding**: app name (e.g. "[A] & [B]'s wedding"),
   support email, and your site's domain once you have it.
3. **Audience**: user type **External**.
4. **Data Access (Scopes)**: keep `…/auth/userinfo.email` and
   `…/auth/userinfo.profile`, and add `openid`. (Step 9 adds one more,
   `…/auth/drive.file`, for the Drive archive.) With only these basic scopes
   Google doesn't need to review your app.
5. **Clients → Create client → Web application**:
   - *Authorized JavaScript origins*: `http://localhost:3000` and later your live URL
   - *Authorized redirect URIs*: the Supabase **Callback URL** from step 2.4
6. Copy the **Client ID** and **Client secret** into the Supabase Google provider
   page from step 2.4 → **Save**.
7. Back in **Audience**, click **Publish app** ("In production") before you send
   invitations. While it says "Testing", only up to 100 listed test users can sign in.

## 4. Connect your Mac copy (optional but handy)

Create `.env.local` in the project folder (copy `.env.example`) and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=…
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…
ADMIN_EMAILS=you@gmail.com,partner@gmail.com
```

In Supabase **Authentication → URL Configuration → Redirect URLs**, add
`http://localhost:3000/auth/callback`. Restart `npm run dev` — the demo banner
disappears and sign-in is real.

## 5. GitHub

Run this in Terminal on your Mac. The GitHub CLI (`gh`) signs you in through your browser
and creates the private repo for you.

```bash
cd ~/develop/bemyguest
git init -b main
git add .
git commit -m "bemyguest"
brew install gh            # once
gh auth login              # GitHub.com → HTTPS → Login with a web browser
gh repo create bemyguest --private --source=. --push
```

## 6. Vercel (hosting)

1. Sign up at https://vercel.com with GitHub → **Add New → Project** → import the repo.
2. Before deploying, open **Environment Variables** and add everything from
   `.env.example`: the three Supabase values, `ADMIN_EMAILS`, and a long random
   `CRON_SECRET`. (Set `NEXT_PUBLIC_SITE_URL` once you know your final URL.)
3. **Deploy**. You get a URL like `https://bemyguest-xyz.vercel.app`.
4. Tell the other services about it:
   - Supabase **Authentication → URL Configuration**: set **Site URL** to that URL
     and add `https://<that-url>/auth/callback` to **Redirect URLs**.
   - Google Cloud **Clients → your client**: add the URL to *Authorized JavaScript origins*.
5. Custom domain (optional): Vercel **Settings → Domains**. Then repeat step 6.4
   with the new domain and set `NEXT_PUBLIC_SITE_URL`.

`vercel.json` pings the database once a day, so Supabase's free plan doesn't pause
it during quiet weeks.

## 7. Before you send invites

- [ ] Sign in with both of your Google accounts and open `/admin`.
- [ ] The site starts in **Rehearsal**: add 3–5 friends as testers on the
      dashboard, ask them to RSVP from their phones, and check them there.
- [ ] Try a +1 request with a tester, approve it, and send the copied invite.
- [ ] Dashboard → **Site settings**: set the RSVP deadline and the contact line
      guests see; check the booth times. Use **Preview the site as a date** to
      see RSVPs closed, the booth open, and the wedding days.
- [ ] **Clear all data** to see the empty site, then **Go live** (one-way) when
      you send the invites.
- [ ] Try "Add to calendar" on an iPhone and an Android phone.
- [ ] Google Auth Platform → Audience says **In production**.
- [ ] Photo Booth: step 8 done, and a test photo shared from a phone on mobile data.
- [ ] Drive archive: step 9 done, connected, and a test archive run.
- [ ] Optional: put Google's official "G" logo at `public/brand/google-g.svg`
      (from Google's sign-in branding guidelines) and the button shows it.

## 8. Photo Booth storage (ImageKit)

The booth opens at **6 AM on Sat 30 Jan**. Until you do this step it runs in test
mode: photos are kept in the server's memory and vanish on restart. Fine on your
Mac, not for the wedding. It takes about 15 minutes.

Photos go straight from guests' phones to ImageKit (shrunk to about 0.5 MB
first), and ImageKit makes the small grid versions on the fly. The site only
records who shared what.

1. **Sign up** at https://imagekit.io on the free plan. It never charges you. If
   it asks where to store images, pick the region closest to India.
2. **Copy three values** from **Developer options → API keys** (in the ImageKit
   dashboard): the **URL endpoint** (`https://ik.imagekit.io/your_id`), the
   **public key** and the **private key**.
3. **Add them** to `.env.local` on your Mac and to Vercel's Environment Variables
   (then redeploy). The private key is a password: never paste it into a chat or
   commit it.

   ```
   IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_id
   IMAGEKIT_PUBLIC_KEY=public_…
   IMAGEKIT_PRIVATE_KEY=private_…
   ```

4. **Database**: run `supabase/schema.sql` again in the Supabase SQL Editor. It's
   safe to re-run; it adds the photo tables and leaves everything else alone.
5. **Try it**: sign in, open `/booth`, use the **Just you two: preview as →
   Weekend** switch, share a photo or two from your phone, heart one from the
   other account, then delete them. `/admin/booth` shows every photo, lets you
   hide one, and downloads a whole day as a ZIP. The photos show up in
   ImageKit's **Media Library** under `booth/`.

**Free plan limits**: 3 GB of files and 20 GB of viewing a month. Photos stay
full quality (2048px, about 0.5–0.9 MB each), so the site keeps you inside the
free plan with two limits:

- **100 photos per guest.** Guests see how many they have left as they get close.
  Thirty keen guests at 100 each is roughly 2 GB.
- **A 2.8 GB safety line.** New uploads pause there (with a friendly message)
  instead of ImageKit cutting things off mid-wedding. Booth control shows how
  full the booth is and turns coral at 80%. If you need more, switch to
  ImageKit's Lite plan ($9 a month, 10 GB) for January and raise
  `storageBudgetMB`.

Don't delete or rename files in the Media Library by hand; delete photos from
the booth so the site stays in step.

Everything is in `src/content/booth.ts`: opening time, when uploads close (the
booth then stays up as the album), 10 photos per share, 100 per guest, and the
storage safety line.

## 9. Photo Booth archive (Google Drive)

A button in Booth control copies every photo's full-size original into your
Google Drive (a **Wedding Photo Booth** folder, one folder per day), then has
ImageKit keep a lighter 1280px copy for the booth. Guests won't notice, and
ImageKit gets back about 70% of its space. Press it whenever you like, or if
Booth control turns coral during the weekend. It only frees **storage**; the
20 GB of monthly **viewing** resets on the 1st (or upgrade ImageKit for a month).

It uses the Google Cloud project from step 3:

1. **APIs & Services → Library**: search for **Google Drive API** → **Enable**.
2. **Google Auth Platform → Data Access → Add or remove scopes**: add
   `…/auth/drive.file`. Google lists it as non-sensitive: it only lets the site
   see the files and folders it creates, nothing else in your Drive.
3. **Clients → your web client → Authorized redirect URIs**: add
   `http://localhost:3000/admin/drive/callback` and
   `https://<your-site>/admin/drive/callback`.
4. **Audience** must say **In production** (step 3.7). While it says "Testing",
   Google cuts the Drive connection after 7 days.
5. Add the client's two values to `.env.local` and to Vercel (then redeploy).
   They're the same **Client ID** and **Client secret** you pasted into Supabase
   in step 3.6:

   ```
   GOOGLE_CLIENT_ID=….apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-…
   ```

6. Run `supabase/schema.sql` again (safe to re-run; it adds the archive columns
   and a locked settings table).
7. Open `/admin/booth` → **Connect Google Drive** → sign in with the Google
   account whose storage you want to use → allow Drive. Then share a test photo
   and press **Archive**. The full-size copy shows up in Drive, the booth still
   shows the photo, and the photo is now under `booth/lite/` in ImageKit.

Good to know: if a guest deletes their photo, its Drive copy goes to your Drive
bin too. The day ZIPs in Booth control give the lighter copies for archived
photos; the full-size ones are in Drive.

## How access works

While the site is in **Rehearsal**, only the two of you (`ADMIN_EMAILS`) and the
testers you add on the dashboard can get in; anyone else who signs in sees an
"almost ready" page and shows up under "Not let in yet". After **Go live**,
anyone with the link can sign in with Google (as you chose). New sign-ins show up
on the dashboard as "Still deciding" until they finish the RSVP.

Plus-ones are requests: a guest gives their +1's name and Google email, you
approve or decline on the dashboard (declining is silent: they keep seeing
"requested"), then copy the invite message and send it yourselves. The +1 signs
in with that email and RSVPs for themselves.

**Remove** hides a stranger's notes and photos and blocks them from RSVPing,
posting or sharing; **Restore** undoes it (hidden photos stay hidden until you
show them again in Booth control).

## Day-to-day controls (Site settings)

- **RSVPs**: the deadline, or close/reopen them by hand. After they close, use
  **Unlock RSVP** next to a guest on the dashboard to let them change their
  answers once; it locks again when they finish.
- **Photo booth**: opening and closing times, photos per guest, the storage
  safety line, and **Pause new photos** (also on Booth control) if anything
  goes wrong mid-event.
- **Announcement**: one line across the top of every page, for time changes,
  rain plans or the shuttle. There's no email, so this is how to reach everyone.
- **Contact**: how guests reach you, shown in the footer and on My profile.
- **Preview the site as a date**: only you see it; saving follows the real clock.

Only signed-in guests can browse the Photo Booth. Each photo file lives at a long
random address, so a guest who copies one photo's address can pass that single
photo on, the same as saving it and sending it.
