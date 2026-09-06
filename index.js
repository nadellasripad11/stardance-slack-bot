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
  const sec = s % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${sec}s`].filter(Boolean).join(" ");
}

const app = new App({
  token: process.env.SLACK_BOT_TOKEN, // Bot User OAuth Token, starts with xoxb-
  appToken: process.env.SLACK_APP_TOKEN, // App-Level Token, starts with xapp-
  socketMode: true,
});

// ---------------------------------------------------------------------------
// /<prefix>-ping  ->  reports acknowledge latency + how long the bot's been up
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-ping`, async ({ ack, respond }) => {
  const start = Date.now();
  await ack();
  const latency = Date.now() - start;
  await respond({ text: `:ping_pong: Pong! Latency: ${latency}ms · uptime: ${uptimeString()}` });
});

// ---------------------------------------------------------------------------
// /<prefix>-help  ->  lists every command the bot knows
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-help`, async ({ ack, respond }) => {
  await ack();
  await respond({
    text: [
      "*Available commands:*",
      `• \`/${PREFIX}-ping\` — latency + uptime`,
      `• \`/${PREFIX}-help\` — show this message`,
      `• \`/${PREFIX}-catfact\` — a random cat fact`,
      `• \`/${PREFIX}-joke\` — a random joke`,
      `• \`/${PREFIX}-8ball <question>\` — ask the magic 8-ball`,
      `• \`/${PREFIX}-roll [NdM]\` — roll dice, e.g. \`2d6\` (default \`1d6\`)`,
    ].join("\n"),
  });
});

// ---------------------------------------------------------------------------
// /<prefix>-catfact  ->  calls a public API and returns a cat fact
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-catfact`, async ({ ack, respond }) => {
  await ack();
  try {
    const { data } = await axios.get("https://catfact.ninja/fact", { timeout: 5000 });
    await respond({ text: `:cat: *Cat fact:*\n${data.fact}` });
  } catch (err) {
    console.error("catfact failed:", err.message);
    await respond({ text: "Failed to fetch a cat fact. Try again in a moment." });
  }
});

// ---------------------------------------------------------------------------
// /<prefix>-joke  ->  calls a public API and returns a joke
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-joke`, async ({ ack, respond }) => {
  await ack();
  try {
    const { data } = await axios.get("https://official-joke-api.appspot.com/random_joke", {
      timeout: 5000,
    });
    await respond({ text: `:laughing: ${data.setup}\n*${data.punchline}*` });
  } catch (err) {
    console.error("joke failed:", err.message);
    await respond({ text: "Failed to fetch a joke. Try again in a moment." });
  }
});

// ---------------------------------------------------------------------------
// /<prefix>-8ball  ->  offline fun, always works (good for demos)
// ---------------------------------------------------------------------------
const EIGHT_BALL = [
  "It is certain.",
  "Without a doubt.",
  "Yes, definitely.",
  "Most likely.",
  "Ask again later.",
  "Cannot predict now.",
  "Don't count on it.",
  "My reply is no.",
  "Very doubtful.",
  "Outlook not so good.",
];
app.command(`/${PREFIX}-8ball`, async ({ command, ack, respond }) => {
  await ack();
  const q = (command.text || "").trim();
  const answer = EIGHT_BALL[Math.floor(Math.random() * EIGHT_BALL.length)];
  await respond({
    text: q ? `:8ball: *${q}*\n${answer}` : `:8ball: ${answer}`,
  });
});

// ---------------------------------------------------------------------------
// /<prefix>-roll  ->  dice roller, "NdM" (e.g. 2d6). Offline, always works.
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-roll`, async ({ command, ack, respond }) => {
  await ack();
  const spec = (command.text || "1d6").trim().toLowerCase();
  const match = spec.match(/^(\d{1,2})?d(\d{1,3})$/);
  if (!match) {
    await respond({ text: `Usage: \`/${PREFIX}-roll 2d6\` (dice between 1d2 and 20d100)` });
    return;
  }
  const count = Math.min(Math.max(parseInt(match[1] || "1", 10), 1), 20);
  const sides = Math.min(Math.max(parseInt(match[2], 10), 2), 100);
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  await respond({
    text: `:game_die: ${count}d${sides} → [${rolls.join(", ")}] = *${total}*`,
  });
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

// Log Bolt-level errors instead of letting them bubble up and kill the process.
app.error(async (error) => {
  console.error("Bolt error:", error);
});

// ---------------------------------------------------------------------------
// Tiny HTTP status page so the deployment has a visitable URL ("demo URL").
// Socket Mode itself needs no web server; this is only a health check, and a
// failure here (e.g. port in use) must never take the bot down.
// ---------------------------------------------------------------------------
const PORT = Number(process.env.PORT) || 3000;
const healthServer = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      status: "ok",
      bot: "stardance-slack-bot",
      commands: [
        `/${PREFIX}-ping`,
        `/${PREFIX}-help`,
        `/${PREFIX}-catfact`,
        `/${PREFIX}-joke`,
        `/${PREFIX}-8ball`,
        `/${PREFIX}-roll`,
      ],
      uptime: uptimeString(),
    })
  );
});
healthServer.on("error", (err) => {
  console.warn(`health check disabled: ${err.code || err.message}`);
});
healthServer.listen(PORT, () => console.log(`health check on http://localhost:${PORT}`));

// ---------------------------------------------------------------------------
// Start the bot + shut down cleanly (matters for systemd on Nest)
// ---------------------------------------------------------------------------
(async () => {
  await app.start();
  console.log(`⚡️ bot is running! commands prefixed with /${PREFIX}-`);
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
