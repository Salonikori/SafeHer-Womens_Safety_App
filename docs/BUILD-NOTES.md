# SafeHer (merged)

One app that combines both versions:

From SafeHer-ReactNative (base): accounts, SOS with 5 second cancel, live tracking link, background location, contacts, WhatsApp/SMS alerts, offline SMS fallback, scam message checker, private reports, privacy tools, calculator disguise with secret code, English/Hindi/Marathi.

From SafeHer-Expo (added): live walking routes (OpenStreetMap), route preview, Bluetooth SOS relay, long-press "Power off" decoy screen on the calculator.

## Run

1. Server
```
cd server
npm install
cp .env.example .env     # set JWT_SECRET to a long random string
npm start
```
Expose it over https for real use (Render, Railway, ngrok). Contacts open `<server>/track.html?t=...`.

2. App
```
cd app
cp .env.example .env     # EXPO_PUBLIC_API_URL = your server address
npm install
npx expo run:android     # development build on a real phone
```
Use a development build, not Expo Go (background location and Bluetooth need native code). Disguised icon/name: `APP_DISGUISE=1 npx expo run:android`.

## New features

Routes tab: type a destination (start defaults to GPS). It fetches walking alternatives, draws their shapes, counts mapped police stations and shops within 120 m of each path, and ranks by "most amenities" or "fastest". Missing data shows as unknown, never as safe. You can open the route in OpenStreetMap, text it to your saved contacts, or jump to live sharing. Needs internet; uses public OSM services (Nominatim, OSRM foot, Overpass), so keep usage light.

Bluetooth relay (SOS tab): scans for phones advertising the SafeHer service and writes your SOS (name, location, tracking link) to them. A receiver must implement service `f3641400-00b0-4240-ba50-05ca45bf8abc` with a writable characteristic `f3641401-00b0-4240-ba50-05ca45bf8abc`; the payload is UTF-8 JSON sent in chunks and ended by a newline. This app is the sender only, so relay works only with a compatible receiver.

Calculator: long-press C for about 1 second to show a fake power-off screen; long-press it for 2.5 seconds to return. Type your secret code and press = to open SafeHer. In the app, long-press the SafeHer title to hide it again.

## Checked

Server: register, contacts, SOS start, location update, public tracking page, end SOS all worked in a local test. App: full Android bundle builds (756 modules), config plugins resolve with Bluetooth permissions, and route scoring/ranking was unit tested with mocked data.

## Not verified

Not run on a physical phone, and the live OSM calls were not tested from my sandbox (no internet to those hosts). Test SMS/WhatsApp delivery, background sharing and Bluetooth on a real device before relying on it. Messages always open in the SMS or WhatsApp app and need you to press Send; the app cannot send silently. Voice trigger is not included.

## Verification and hosting notes

- Server smoke tests: `cd server && npm test`
- App smoke tests: `cd app && npm test`
- Set `TRUST_PROXY=1` only when the deployment has one trusted reverse-proxy hop; adjust to the actual trusted hop count for your host. Do not set it to `true` without understanding the proxy chain.
- The browser route planner uses OpenStreetMap Nominatim, OSRM foot routing, and Overpass amenity data. These public services can rate-limit or be unavailable; unavailable amenity data is shown as `unknown`, not as a safety guarantee.
