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

### Still to do
- Create the Slack app + generate the `xoxb-` / `xapp-` tokens, fill in `.env`.
- `npm install` and run locally (needs Node.js installed).
- Register the four slash commands in the Slack dashboard.
- Deploy to Nest and enable the systemd service.
