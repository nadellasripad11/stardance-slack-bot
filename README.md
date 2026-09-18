# stardance slack bot

my slack bot for the hack club [stardance "make a slack bot" mission](https://stardance.hackclub.com/missions/slack-bot/guide).

it talks to slack over socket mode, which means it opens a websocket to slack instead of running a web server, so there's no public url to host. you just run the process and it stays connected. it answers slash commands, all prefixed with `sripin-` so they don't clash with the other bots in the hack club workspace.

## commands

| command | what it does |
| --- | --- |
| `/sripin-ping` | latency + how long the bot's been up |
| `/sripin-help` | lists everything |
| `/sripin-catfact` | random cat fact |
| `/sripin-joke` | random joke |
| `/sripin-quote` | random quote, has an offline fallback if the api is down |
| `/sripin-weather london` | current weather, uses wttr.in, no api key needed |
| `/sripin-define clever` | dictionary definition, uses the datamuse api |
| `/sripin-trivia` | random multiple-choice trivia question from open trivia db |
| `/sripin-number 42` | an interesting fact about a number (or a random one) |
| `/sripin-rps rock` | play rock-paper-scissors with the bot |
| `/sripin-fact` | a random useless (but true) fact |
| `/sripin-country japan` | quick facts about a country |
| `/sripin-morse hello` | encode text in morse code (offline) |
| `/sripin-8ball will this work` | magic 8-ball, works offline |
| `/sripin-roll 2d6` | roll dice, defaults to 1d6 |
| `/sripin-flip` | coin flip |
| `/sripin-choose pizza, tacos, sushi` | picks one at random |
| `@sripin bot` | mention it and it points you to `/sripin-help` |

the fun ones reply in the channel so everyone can see them. ping and help only reply to you.

every command that hits an api has a timeout and a try/catch, so a dead api gives you a "try again" message instead of crashing the bot. it also shuts down cleanly on sigint/sigterm so a systemd restart doesn't leave anything hanging.

## running it locally

you need node 18 or newer.

```bash
npm install
```

then make a `.env` file with your slack tokens:

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
COMMAND_PREFIX=sripin
PORT=3737
```

```bash
npm start
```

when it works you'll see `⚡️ bot is running!` and `now connected to slack`. then run a command in a channel you've invited the bot to (use `#bot-spam`, not `#stardance`).

there's also a little health endpoint at `http://localhost:3737` that returns some json. socket mode doesn't need it, it's just handy for checking the process is alive, and if the port is taken it quietly disables itself instead of killing the bot.

## the slack app

the app config lives in [`manifest.json`](./manifest.json). at <https://api.slack.com/apps> pick "from a manifest", choose the hack club workspace, paste that file. it sets up all the slash commands, the bot scopes (`chat:write`, `commands`, `app_mentions:read`, `channels:history`), the `app_mention` event and socket mode in one go.

then you still do two things by hand:

1. basic information → app-level tokens → generate one with the `connections:write` scope, that's your `xapp-` token
2. install app → install to workspace, then oauth & permissions has your `xoxb-` token

## keeping it online 24/7

the bot only runs while the process runs, so for the mission it needs to live on a server. this uses hack club nest. the systemd unit is in [`slackbot.service`](./slackbot.service) and there's a copy-paste setup in [`deploy-nest.sh`](./deploy-nest.sh). rough version:

```bash
# on nest, as root
apt update && apt install -y git curl ca-certificates nano
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs
git clone https://github.com/nadellasripad11/stardance-slack-bot
cd stardance-slack-bot && npm install
nano .env            # same two tokens as local
cp slackbot.service /etc/systemd/system/slackbot.service
systemctl daemon-reload
systemctl enable --now slackbot.service
journalctl -u slackbot.service -f
```

## time tracking

coding time on this is tracked with hackatime (hack club's wakatime-compatible thing) through `~/.wakatime.cfg`. the work log is in [`DEVLOG.md`](./DEVLOG.md).
