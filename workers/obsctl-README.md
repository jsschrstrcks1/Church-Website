# obsctl — one-button Go Live

Tiny companion that turns **one press** into the whole "on air" flow: start the OBS
stream AND flip the church site's live flag (homepage shows the YouTube embed + Watch on
Facebook). Runs on the streaming PC that already has OBS open.

## What it does

- `go`    → starts OBS streaming (StartStream) → flips site `/live/state` to live
- `stop`  → stops OBS streaming → flips site off
- `status`→ shows current OBS stream state (+ the site flag if a token is set)

## Setup (one time, on the OBS PC)

1. **OBS → Tools → WebSocket Server** → enable, set a password, note the port (default 4455).
2. In OBS, make your streaming output point at YouTube (Settings → Stream), and if you also
   go to Facebook, **add a second Output** (Settings → Output → "Stream" as YouTube, and a
   second "Stream" named e.g. `facebook` pointing at Facebook's RTMP) — or use OBS's built-in
   multiple outputs / Restream.
3. Get a site token once (from the members area login, or curl `/auth/login` → `token`).
4. Put it in a `.env.local`-style file or export when you run it.

## Run

```bash
# from the workers/ folder
export OBS_PASSWORD='your-obs-websocket-password'
export LW_TOKEN='your-lakeview-login-token'
node obsctl.mjs go
node obsctl.mjs status
node obsctl.mjs stop
```

## Honest limits

- **OBS must be open and WebSocket Server enabled** on the PC running `obsctl`; the browser
  cannot drive OBS, so this script lives on that machine.
- `OBS_PASSWORD` is required — the script refuses to connect without it (exit 1). It never
  auto-starts streaming on a box it can't authenticate to.
- `StopStream` stops OBS's main stream output. An extra Facebook output started separately in
  OBS must be stopped in OBS (OBS's own End Stream stops all outputs together).
- Without `LW_TOKEN`, OBS still starts but the site flag is not flipped (told on stdout).
