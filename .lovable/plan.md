# Nyra: Calendar, Search, Weather & a Much Smarter Brain

You asked for a lot at once. Here's what I can genuinely build now, what needs one small action from you, and what is not physically possible without extra hardware/permissions — stated honestly rather than faked.

## 1. A genuinely smarter Nyra (the big one)

Today Nyra uses keyword matching: if your phrasing doesn't match a pattern, nothing happens. I'll replace that with a real tool-using agent:

- Nyra's brain gets a set of tools (calendar, search, weather, location, memory, tasks, devices) and decides itself which to call, in what order, and can chain several before answering.
- No buttons, no magic phrasing. "What's my day look like?", "Am I free Thursday afternoon?", "What's the weather?" all just work.
- Upgrade to a stronger model with tool-calling and keep replies short and spoken-friendly.
- Nyra remembers automatically (important facts saved without you saying "remember that").

## 2. Google Calendar

- Read-only first: today/this week's events, "am I free at X", conflict spotting, a spoken morning summary.
- Write actions (create / move / cancel) go behind an explicit confirmation step: Nyra states exactly what it will change and only acts after you say yes. Nothing is ever changed silently.
- Connection: I'll open a Google Calendar connect card in chat — you sign in with Google once, no tokens to copy anywhere.

## 3. Web search + weather + location

- Web search skill so Nyra can answer live questions ("what's happening with X", "how much is Y") with sources.
- Location: browser geolocation, asked for once, stored locally, revocable in Settings. Never sent anywhere except the weather lookup.
- Weather from your coordinates, no key needed.

## 4. Hands-free morning flow

Wake-word listening already exists; I'll make it actually good:
- "Good morning Nyra" triggers a briefing: weather, calendar, top tasks, in one spoken paragraph.
- Wake word stays on in the tab, no button press, and the orb shows it's awake.

## 5. Devices without Home Assistant — the honest part

A web app running in a browser **cannot** reach your lights, TV or plugs directly; there's no browser API for that. Options that actually work:

- **Cloud integrations** (real, buildable): Spotify is the best first one — connect your account and Nyra can play/pause/skip/queue by voice. Same model later for Philips Hue, Tuya/SmartLife, LIFX, Google Home — each is an account sign-in, no tokens.
- **Local network control** requires a small helper running on your laptop. Since you're hosting Nyra on your laptop anyway, that's very doable — but it's a separate piece of work after this.

So: I'll build the **Spotify** account-based path now, keep the device layer bridge-agnostic, and drop the "you need a Home Assistant token" framing from the UI.

## 6. Security

Realistic protections, not a fake firewall:
- All keys stay server-side; nothing sensitive ever reaches the browser.
- Prompt-injection guarding so a web page or calendar invite can't make Nyra act.
- Every action that changes something (calendar edit, device command) is confirmed first and written to the activity log.
- Rate limiting and strict input validation on all endpoints.
- A "private mode" that stops all listening instantly.

## Technical notes

- Agent loop with AI SDK tool calling inside a `createServerFn`; tools execute server-side only.
- Google Calendar via the Lovable Google Calendar connector (gateway-proxied, OAuth, no tokens in code).
- Weather via Open-Meteo (keyless); search via a server-side search tool.
- New files: `src/lib/nyra/agent/*` (tool registry + loop), `src/lib/nyra/tools/{calendar,search,weather,location}.ts`, `src/routes/api/...` additions.
- Confirmation protocol: write tools return a `pending_confirmation` payload the UI renders and the user approves by voice or tap.

## Suggested order

1. Smarter agent brain + auto-memory
2. Google Calendar (read, then confirmed writes)
3. Search + location + weather
4. Morning briefing / wake-word flow
5. Spotify
6. Security hardening pass
