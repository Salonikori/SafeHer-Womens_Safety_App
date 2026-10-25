# SafeHer: Women's Safety Web App

Full-stack app: HTML/CSS/JS frontend (public/), Node.js + Express API and web server (server.js, scan.js), SQLite database (data.db, created automatically).

## Run
1. npm install   (Node 18 or newer)
2. copy .env.example to .env and set JWT_SECRET
3. npm start, then open http://localhost:3000

Geolocation needs HTTPS or localhost. For contacts to open the live tracking link, the server must be reachable from the internet (Render, Railway, a VPS, or an ngrok tunnel).

## Features
- SOS: 5-second cancel countdown, then a live tracking link, one-tap WhatsApp/SMS alert buttons for saved contacts, and 112 and 181 call buttons. While active, a status panel shows:
  - Server link: working, or "not reaching the server" with the number of failed tries, automatic retry every 10 seconds, a Retry now button and a backup "send my location by SMS" button
  - Location accuracy in metres, labelled good (30 m or better), fair (up to 100 m) or poor, with a weak-fix tip; clear messages if location is blocked or unavailable
  - Tracking link seen: whether someone has opened the link and whether they are watching now (the only real delivery signal the system has)
  - Per-contact status: Not sent yet, then "WhatsApp/SMS opened, not sent until you press Send there", then "You confirmed it was sent". Only contacts the user confirms count as sent.
  - Start retries: 3 attempts with short delays before falling back. If they all fail, the SMS fallback says plainly that nobody has been alerted yet and that the user must press Send in the SMS app, and records confirmation only when she says so.
- Live location sharing (no alarm) with a public tracking page (public/track.html):
  - Clear consent first: before a public link is created, a dialog explains that anyone with the link can see the person's live location and name, that the app does not send it for her, and how to stop. She must tick a box and choose how long to share (30 minutes to 12 hours). The server refuses to create a link without `consent: true`. For SOS, pressing the button and not cancelling the 5-second countdown is the consent, and the screen says so.
  - Visible sharing indicator: a bar at the top of every screen (SOS red, sharing green) shows that she is being tracked, the time left, and Stop sharing. It also appears again after a page reload or sign-in if sharing is still on. (If Calculator disguise is switched on and the app is hidden, the bar is hidden with everything else.)
  - Automatic expiry: every link has an expiry (default 2 hours for sharing, 4 hours for SOS, never more than 12 hours). Add 30 minutes extends it up to that limit. When it expires the server closes the link, deletes the stored points and the app says so. The tracking page shows contacts when sharing will stop.
  - Stop controls: Stop sharing in the bar, in the sharing controls and at the bottom of the SOS screen (SOS asks to confirm in the bar). Stopping kills the link at once and deletes stored location points. Signing out or deleting the account also stops sharing. The "ended" notice on the link stays for 2 hours, then the link returns "no longer available".
- Emergency contacts (up to 5) and profile, stored encrypted.
- Suspicious-message checker (public/msgcheck.js, runs in the browser):
  - 24 scam patterns: OTP/PIN/CVV, KYC and blocked-account, fake bank or government links, prizes, send-money and fee requests, UPI collect/QR, shortened or odd links, APK and remote-access apps (AnyDesk etc.), blackmail and sextortion, secrecy, requests for photos or location, fake police/CBI/digital arrest, courier and parcel, fake jobs and tasks, investment and trading, electricity/SIM disconnection, refund and "sent by mistake", fake support numbers, rental and OLX advance, romance and emergency stories, move-to-another-app, generic greetings. Dangerous combinations (for example pressure plus a request for credentials) raise the score. A genuine "do not share your OTP" notice is recognised and rated low.
  - Multilingual: matches English, Hindi, Marathi (Devanagari) and Hinglish (Hindi in Latin letters). It detects and shows the message language, and explains every result in the chosen interface language (English, Hindi or Marathi).
  - Highlighted evidence: the exact words that triggered each warning are marked in the message with numbers that match the numbered reasons below it. Dark-red marks are strong signs, amber are weaker. Links in the message are listed so the real domain is visible.
  - Feedback: "Was this result right?" with Yes / No it is a scam / No it is safe, an optional comment, and an optional checkbox to include the message text (off by default). Each reason also has "Not a problem", which stops that warning type on this device (with a Reset link) and records a false alarm. Feedback goes to POST /api/feedback. The message text is stored only if the user ticks the box, and comments and text are encrypted. Maintainers set ADMIN_TOKEN and read GET /api/admin/feedback (header x-admin-token) to see per-rule false-alarm, correct and missed counts.
- Safety reports: private and encrypted.
  - Incident categories: harassment, stalking, online abuse, suspicious message, unsafe place, physical assault, theft or robbery, verbal abuse or catcalling, cyber fraud or scam, workplace harassment, domestic violence, other. Filter the list by category.
  - Date and time the incident happened (future times are refused), separate from when it was recorded.
  - Optional evidence: free-text notes plus up to 3 files per report (JPG, PNG, WebP, GIF or PDF, 2 MB each, 25 MB per account). File contents are checked, stored encrypted, and only the owner can open them. Files can be added or removed later. Files are stored as uploaded, including hidden photo data.
  - Export: "Save as PDF" (a print page with details and attached photos, for one report or all shown reports) and "Download all as CSV" (spreadsheet-safe, with file names).
- Image Privacy Guard: reads photo location, time and device data, warns, and saves a clean copy. Runs in the browser.
- Footprint scan, real lookups made when you press scan:
  - Data breaches for the account email (XposedOrNot, free; Have I Been Pwned if HIBP_API_KEY is set)
  - Public Gravatar photo for the email
  - Username on 10 sites with public APIs (GitHub, GitLab, Reddit, Keybase, Hacker News, Chess.com, Lichess, DEV, Docker Hub, Mastodon)
  - Web results mentioning your email, phone or name, flagging data-broker sites (needs BRAVE_API_KEY, free tier)
  - Exposure score from real findings only, removal steps, request templates, progress saved per account
  - "Check these yourself" links for things that cannot be looked up automatically (caller-ID apps, photos, social privacy settings)
- Password leak check (k-anonymity: only 5 hash characters leave the browser).
- Accounts, scan history, delete account and all data. English, Hindi and Marathi for the main screens.

- Calculator disguise (Account, Privacy mode): the app opens as a working calculator. Typing the user's secret code (4 to 8 digits) and pressing = opens SafeHer. "Hide app" button, Escape key, and automatic hiding when switching apps return to the calculator. The code is stored only as a salted SHA-256 hash on the device, and the tab title becomes "Calculator".
- Voice trigger: say "help", "bachao" or "madad" and a 5-second cancellable SOS countdown starts (it reveals the app if disguised). Uses the browser's speech recognition: Chrome or Edge, page must stay open, needs internet.
- Offline SOS fallback: contacts are cached on the device. If the server cannot be reached, SOS builds an SMS with the location link to all saved contacts and queues a note. When back online, she is offered to start live sharing. A service worker (public/sw.js) lets the app open with no connection.

## Safeguards
Sign-in required for scans, consent required, scans limited to 8 per day per user, and the email checked is always the account's own email, so the tool cannot be used to look up other people. Rate limiting, Helmet security headers, httpOnly cookies, bcrypt passwords and input validation are on.

## Data stored
Email, bcrypt password hash, scan score and checklist progress, and AES-256-GCM encrypted profile, contacts and reports. The key comes from ENC_KEY, JWT_SECRET or an auto-generated .secret file. Back it up, or encrypted data cannot be read. Names, phones, usernames and cities typed into the scan are used once and not stored. Photos and pasted messages never leave the browser, except a message the user explicitly chooses to include with feedback (stored encrypted).

## API
POST /api/register, /api/login, /api/logout; GET/DELETE /api/me; PUT /api/profile; GET/POST/DELETE /api/contacts; POST /api/sos (needs consent:true, optional minutes), GET /api/sos/active, POST /api/sos/:id/loc and /end; GET /api/track/:token (public); GET/POST/DELETE /api/reports (POST takes type, incident_at, place, description, evidence); GET /api/reports/export.csv; POST /api/reports/:id/evidence, GET/DELETE /api/reports/:id/evidence/:fid; POST /api/sos/:id/extend; POST /api/feedback (message-checker feedback), GET /api/admin/feedback (needs ADMIN_TOKEN); POST /api/scan; POST /api/pwned; POST/PATCH/GET /api/scans.

## Limits to know
- Automatic expiry is enforced by the server (a sweep runs every minute and links are checked on every request), so it holds even if the phone goes offline. A phone that loses signal simply stops sending new points.
- Exporting a PDF uses the browser's print dialog, so pick "Save as PDF" there. Pop-ups must be allowed for the site.
- Voice trigger and the offline SMS both depend on the phone: the SMS app opens ready to send and she must tap send, and browsers cannot listen to the microphone in the background or with the screen off.
- Saved contacts are kept in plain text in this browser's storage for the offline fallback. They are removed on sign out and account deletion. If she forgets her calculator code, she must clear the site's data.
- Alerts open the user's own WhatsApp or SMS app, because browsers cannot send texts silently, and nothing can confirm that a text was delivered. The app therefore never shows 'sent' unless the user confirms it. Twilio can automate sending and report real delivery.
- "Nothing found" means these sources had no match, not that nothing exists. Phone numbers on caller-ID apps and reverse image matches cannot be looked up automatically.
- Message detection is a heuristic, not a guarantee. It can miss new scams and can flag genuine messages. Rules are keyword patterns, so heavily misspelled text, other scripts (for example Tamil or Bengali) or images of text are not understood. Use the feedback buttons to report mistakes.
- Free upstream APIs have rate limits; a check that cannot be reached is shown as "Could not check right now".
