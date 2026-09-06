// Stardance "Make a Slack Bot" mission
// A Slack bot that answers slash commands over Socket Mode (no public URL needed).

require("dotenv").config();

const http = require("http");
const { App } = require("@slack/bolt");
const axios = require("axios");

// All commands are prefixed with your bot's name so they don't collide with
// other bots in the Hack Club workspace (e.g. "/sripin-ping" instead of "/ping").
// Change COMMAND_PREFIX in your .env if you registered a different command name in Slack.
const PREFIX = process.env.COMMAND_PREFIX || "sripin";

const STARTED_AT = Date.now();

function uptimeString() {
  const s = Math.floor((Date.now() - STARTED_AT) / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s % 60}s`].filter(Boolean).join(" ");
}

// Small wrapper so every API call has a timeout and a predictable failure.
async function httpGet(url, opts = {}) {
  const { data } = await axios.get(url, { timeout: 6000, ...opts });
  return data;
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN, // Bot User OAuth Token, starts with xoxb-
  appToken: process.env.SLACK_APP_TOKEN, // App-Level Token, starts with xapp-
  socketMode: true,
});

// Fun commands post publicly so they show up in the channel (nice for demos).
// Utility commands (ping/help) stay ephemeral.
const inChannel = (text) => ({ response_type: "in_channel", text });

// Log every incoming slash command so it's easy to see the bot working.
app.use(async ({ body, next }) => {
  if (body && body.command) {
    const who = body.user_name ? `@${body.user_name}` : body.user_id;
    const args = (body.text || "").trim();
    console.log(`[cmd] ${body.command}${args ? ` ${args}` : ""}  (${who} in #${body.channel_name || body.channel_id})`);
  }
  await next();
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-ping`, async ({ ack, respond }) => {
  const start = Date.now();
  await ack();
  await respond({ text: `:ping_pong: Pong! Latency: ${Date.now() - start}ms · uptime: ${uptimeString()}` });
});

const COMMANDS = [
  ["ping", "latency + uptime"],
  ["help", "show this message"],
  ["catfact", "a random cat fact"],
  ["joke", "a random joke"],
  ["quote", "a random inspirational quote"],
  ["weather <place>", "current weather, e.g. `london`"],
  ["define <word>", "dictionary definition"],
  ["8ball <question>", "ask the magic 8-ball"],
  ["roll [NdM]", "roll dice, e.g. `2d6`"],
  ["flip", "flip a coin"],
  ["choose a, b, c", "pick one at random"],
];

app.command(`/${PREFIX}-help`, async ({ ack, respond }) => {
  await ack();
  await respond({
    text: [
      "*Available commands:*",
      ...COMMANDS.map(([c, d]) => `• \`/${PREFIX}-${c}\` — ${d}`),
    ].join("\n"),
  });
});

// ---------------------------------------------------------------------------
// API-backed commands
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-catfact`, async ({ ack, respond }) => {
  await ack();
  try {
    const data = await httpGet("https://catfact.ninja/fact");
    await respond(inChannel(`:cat: *Cat fact:*\n${data.fact}`));
  } catch (err) {
    console.error("catfact failed:", err.message);
    await respond({ text: "Failed to fetch a cat fact. Try again in a moment." });
  }
});

app.command(`/${PREFIX}-joke`, async ({ ack, respond }) => {
  await ack();
  try {
    const data = await httpGet("https://official-joke-api.appspot.com/random_joke");
    await respond(inChannel(`:laughing: ${data.setup}\n*${data.punchline}*`));
  } catch (err) {
    console.error("joke failed:", err.message);
    await respond({ text: "Failed to fetch a joke. Try again in a moment." });
  }
});

const FALLBACK_QUOTES = [
  "The best way out is always through. — Robert Frost",
  "Done is better than perfect.",
  "Ship it. — every Hack Clubber, eventually",
];
app.command(`/${PREFIX}-quote`, async ({ ack, respond }) => {
  await ack();
  try {
    const data = await httpGet("https://zenquotes.io/api/random");
    const q = data[0];
    await respond(inChannel(`:sparkles: “${q.q}” — *${q.a}*`));
  } catch (err) {
    console.error("quote failed:", err.message);
    const q = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
    await respond(inChannel(`:sparkles: ${q}`));
  }
});

app.command(`/${PREFIX}-weather`, async ({ command, ack, respond }) => {
  await ack();
  const place = (command.text || "").trim();
  if (!place) {
    await respond({ text: `Usage: \`/${PREFIX}-weather <place>\` — e.g. \`/${PREFIX}-weather Tokyo\`` });
    return;
  }
  try {
    // wttr.in needs no API key; format=3 => "London: ⛅️ +12°C"
    const line = await httpGet(`https://wttr.in/${encodeURIComponent(place)}?format=3`, {
      responseType: "text",
      headers: { "User-Agent": "curl" },
    });
    await respond(inChannel(`:partly_sunny: ${String(line).trim()}`));
  } catch (err) {
    console.error("weather failed:", err.message);
    await respond({ text: `Couldn't get weather for "${place}".` });
  }
});

app.command(`/${PREFIX}-define`, async ({ command, ack, respond }) => {
  await ack();
  const word = (command.text || "").trim().split(/\s+/)[0];
  if (!word) {
    await respond({ text: `Usage: \`/${PREFIX}-define <word>\`` });
    return;
  }
  try {
    const data = await httpGet(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );
    const meaning = data[0].meanings[0];
    const def = meaning.definitions[0].definition;
    await respond(inChannel(`:book: *${data[0].word}* _(${meaning.partOfSpeech})_\n${def}`));
  } catch (err) {
    console.error("define failed:", err.message);
    await respond({ text: `No definition found for "${word}".` });
  }
});

// ---------------------------------------------------------------------------
// Offline fun (no network, never fails)
// ---------------------------------------------------------------------------
const EIGHT_BALL = [
  "It is certain.", "Without a doubt.", "Yes, definitely.", "Most likely.",
  "Ask again later.", "Cannot predict now.", "Don't count on it.",
  "My reply is no.", "Very doubtful.", "Outlook not so good.",
];
app.command(`/${PREFIX}-8ball`, async ({ command, ack, respond }) => {
  await ack();
  const q = (command.text || "").trim();
  const a = EIGHT_BALL[Math.floor(Math.random() * EIGHT_BALL.length)];
  await respond(inChannel(q ? `:8ball: *${q}*\n${a}` : `:8ball: ${a}`));
});

app.command(`/${PREFIX}-roll`, async ({ command, ack, respond }) => {
  await ack();
  const spec = (command.text || "1d6").trim().toLowerCase();
  const m = spec.match(/^(\d{1,2})?d(\d{1,3})$/);
  if (!m) {
    await respond({ text: `Usage: \`/${PREFIX}-roll 2d6\` (1d2 to 20d100)` });
    return;
  }
  const count = Math.min(Math.max(parseInt(m[1] || "1", 10), 1), 20);
  const sides = Math.min(Math.max(parseInt(m[2], 10), 2), 100);
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  await respond(inChannel(`:game_die: ${count}d${sides} → [${rolls.join(", ")}] = *${rolls.reduce((a, b) => a + b, 0)}*`));
});

app.command(`/${PREFIX}-flip`, async ({ ack, respond }) => {
  await ack();
  await respond(inChannel(`:coin: ${Math.random() < 0.5 ? "Heads" : "Tails"}`));
});

app.command(`/${PREFIX}-choose`, async ({ command, ack, respond }) => {
  await ack();
  const options = (command.text || "")
    .split(/,|\bor\b/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (options.length < 2) {
    await respond({ text: `Usage: \`/${PREFIX}-choose pizza, tacos, sushi\`` });
    return;
  }
  await respond(inChannel(`:thinking_face: I pick *${options[Math.floor(Math.random() * options.length)]}*`));
});

// ---------------------------------------------------------------------------
// @mention the bot  ->  friendly reply (uses the app_mentions:read scope)
// ---------------------------------------------------------------------------
app.event("app_mention", async ({ event, say }) => {
  await say({
    text: `Hi <@${event.user}>! Try \`/${PREFIX}-help\` to see what I can do.`,
    thread_ts: event.thread_ts || event.ts,
  });
});

app.error(async (error) => {
  console.error("Bolt error:", error);
});

// ---------------------------------------------------------------------------
// Tiny HTTP status page. Socket Mode needs no web server; this is only a health
// check, and a failure here (e.g. port in use) must never take the bot down.
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;
const healthServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "ok",
      bot: "stardance-slack-bot",
      commands: COMMANDS.map(([c]) => `/${PREFIX}-${c.split(" ")[0]}`),
      uptime: uptimeString(),
    })
  );
});
healthServer.on("error", (err) => console.warn(`health check disabled: ${err.code || err.message}`));
healthServer.listen(PORT, () => console.log(`health check on http://localhost:${PORT}`));

// ---------------------------------------------------------------------------
// Start + clean shutdown (matters for systemd on Nest)
// ---------------------------------------------------------------------------
(async () => {
  await app.start();
  console.log(`⚡️ bot is running! ${COMMANDS.length} commands, prefixed with /${PREFIX}-`);
})();

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    console.log(`\n${sig} received, shutting down...`);
    try {
      await app.stop();
    } catch (_) {}
    healthServer.close();
    process.exit(0);
  });
}
