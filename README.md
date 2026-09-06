# Stardance Slack Bot

A Hack Club Slack bot built for the [Stardance "Make a Slack Bot" mission](https://stardance.hackclub.com/missions/slack-bot/guide).
It listens for slash commands over **Socket Mode** (a WebSocket connection to Slack — no public URL required) and replies in the channel.

## Commands

| Command | What it does |
| --- | --- |
| `/sripin-ping` | Replies with the bot's response latency in milliseconds |
| `/sripin-help` | Lists every command |
| `/sripin-catfact` | Fetches a random cat fact from `catfact.ninja` |
| `/sripin-joke` | Fetches a random joke from `official-joke-api.appspot.com` |
| `@mention` the bot | Replies with a friendly pointer to `/sripin-help` |

> The `sripin-` prefix keeps these commands from colliding with other bots in the
> Hack Club workspace. Change it by setting `COMMAND_PREFIX` in `.env` (and by
> registering the matching command name in the Slack app dashboard).

## Tech stack

- **Node.js** (>= 18)
- **[@slack/bolt](https://slack.dev/bolt-js/)** with **Socket Mode**
- **axios** for the API-backed commands
- **dotenv** for local secrets

## Local setup

```bash
npm install
cp .env.example .env   # then paste your real Slack tokens into .env
npm start
```

You should see:

```
health check on http://localhost:3000
⚡️ bot is running!
```

Then run a slash command from any Slack channel you've invited the bot to (use
`#bot-spam`, **not** `#stardance`).

### Slack app configuration

Create the app at <https://api.slack.com/apps> → **From scratch**, in the Hack Club workspace, then:

1. **Socket Mode** → enable it.
2. **Basic Information → App-Level Tokens** → generate a token with the `connections:write` scope (starts `xapp-`).
3. **OAuth & Permissions → Bot Token Scopes** → add: `chat:write`, `commands`, `app_mentions:read`, `channels:history`.
4. **Install App** → install to workspace → copy the **Bot User OAuth Token** (starts `xoxb-`).
5. **Slash Commands** → create `/sripin-ping`, `/sripin-help`, `/sripin-catfact`, `/sripin-joke`.

Put the two tokens in `.env`:

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
```

## The "demo URL"

A Socket Mode bot is **not** a website — it makes an outbound WebSocket connection
to Slack, so there is no public web address for the bot itself. This project adds a
small **health-check endpoint** so a deployment still has something you can open in
a browser:

- Local: <http://localhost:3000>
- On Nest: reachable at your `https://<username>.hackclub.app` domain once you
  point it at the app's port.

It returns JSON like:

```json
{ "status": "ok", "bot": "stardance-slack-bot", "commands": ["/sripin-ping", "..."], "uptime_seconds": 42 }
```

The real demo is the bot replying to a slash command in Slack — capture that with a
screenshot or short screen recording for your Stardance submission.

## Deploy 24/7 on Nest

See [`slackbot.service`](./slackbot.service). Summary:

```bash
# on the Nest server, as root
apt update && apt install -y git curl ca-certificates nano
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs
git clone https://github.com/nadellasripad11/stardance-slack-bot
cd stardance-slack-bot && npm install
nano .env            # recreate the same SLACK_BOT_TOKEN / SLACK_APP_TOKEN
cp slackbot.service /etc/systemd/system/slackbot.service
systemctl daemon-reload
systemctl enable --now slackbot.service
systemctl status slackbot.service
journalctl -u slackbot.service -f
```

## Time tracking

Coding time on this project is tracked with **Hackatime** (Hack Club's WakaTime-compatible
service) via `~/.wakatime.cfg`. See [`DEVLOG.md`](./DEVLOG.md) for the work log.
