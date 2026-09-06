# Devlog — Stardance Slack Bot

## 2026-09-06 — Project scaffold

- Read through the Stardance "Make a Slack Bot" guide (8 steps: Slack app setup,
  build locally, add commands, push to GitHub, deploy on Nest).
- Set up **Hackatime** time tracking: wrote `~/.wakatime.cfg` pointing at
  `https://hackatime.hackclub.com/api/hackatime/v1`. Verified the API key resolves
  to my account and that heartbeats are accepted and aggregated on the dashboard.
- Created the Node project:
  - `package.json` — `@slack/bolt`, `axios`, `dotenv`; `npm start` → `node index.js`.
  - `index.js` — Bolt app in Socket Mode with four slash commands
    (`-ping`, `-help`, `-catfact`, `-joke`), an `app_mention` handler, and a small
    HTTP health-check endpoint on port 3000.
  - `.env.example`, `.gitignore` (ignores `node_modules` + `.env`), `LICENSE` (MIT).
  - `slackbot.service` — systemd unit template for the Nest deployment.
  - `README.md` — setup, command reference, deploy steps, notes on why a Socket
    Mode bot has no public URL.
- Initialised the git repository and pushed to GitHub.
- Wrote `manifest.json` and created the Slack app ("Sripin Bot", app ID `A0C0156NAMS`)
  from it — scopes, four slash commands, `app_mention` event and Socket Mode all
  come from the manifest.
- Generated the App-Level Token (`connections:write`) and installed the app to the
  Hack Club workspace to get the Bot User OAuth Token; both live in `.env` (gitignored).
- Verified both tokens against the Slack API: `auth.test` returns the bot user
  `sripin_bot` in the Hack Club workspace, and `apps.connections.open` returns a
  Socket Mode WebSocket URL — so the bot connects.

- Installed Node.js v24, ran `npm install` (219 packages), started the bot.
  First run crashed on `EADDRINUSE` (port 3000 taken locally) — the health
  server error was fatal. Fixed: health-server errors are now non-fatal, port is
  configurable (`PORT` in `.env`, set to 3737), added an `app.error` handler and
  clean `SIGINT`/`SIGTERM` shutdown.
- Added two offline commands that are handy for demos: `/sripin-8ball` and
  `/sripin-roll` (NdM dice). Updated `manifest.json` to match.
- Bot now starts cleanly: `⚡️ bot is running!` → `Now connected to Slack`, and
  `http://localhost:3737` returns a JSON health payload.

### Still to do
- Re-sync `manifest.json` in the Slack dashboard so `/sripin-8ball` and
  `/sripin-roll` register (the first four commands already work).
- Test the slash commands live in `#bot-spam`.
- Deploy to Nest and enable the systemd service for 24/7 uptime.
