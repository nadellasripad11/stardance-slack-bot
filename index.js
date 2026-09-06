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

const app = new App({
  token: process.env.SLACK_BOT_TOKEN, // Bot User OAuth Token, starts with xoxb-
  appToken: process.env.SLACK_APP_TOKEN, // App-Level Token, starts with xapp-
  socketMode: true,
});

// ---------------------------------------------------------------------------
// /<prefix>-ping  ->  reports how long the bot took to acknowledge
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-ping`, async ({ ack, respond }) => {
  const start = Date.now();
  await ack();
  const latency = Date.now() - start;
  await respond({ text: `:ping_pong: Pong! Latency: ${latency}ms` });
});

// ---------------------------------------------------------------------------
// /<prefix>-help  ->  lists every command the bot knows
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-help`, async ({ ack, respond }) => {
  await ack();
  await respond({
    text: [
      "*Available commands:*",
      `• \`/${PREFIX}-ping\` — check the bot's latency`,
      `• \`/${PREFIX}-help\` — show this message`,
      `• \`/${PREFIX}-catfact\` — get a random cat fact`,
      `• \`/${PREFIX}-joke\` — get a random joke`,
    ].join("\n"),
  });
});

// ---------------------------------------------------------------------------
// /<prefix>-catfact  ->  calls a public API and returns a cat fact
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-catfact`, async ({ ack, respond }) => {
  await ack();
  try {
    const response = await axios.get("https://catfact.ninja/fact");
    await respond({ text: `:cat: *Cat fact:*\n${response.data.fact}` });
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
    const response = await axios.get("https://official-joke-api.appspot.com/random_joke");
    await respond({ text: `:laughing: ${response.data.setup}\n*${response.data.punchline}*` });
  } catch (err) {
    console.error("joke failed:", err.message);
    await respond({ text: "Failed to fetch a joke. Try again in a moment." });
  }
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

// ---------------------------------------------------------------------------
// Tiny HTTP status page so the deployment has a visitable URL ("demo URL").
// Socket Mode itself needs no web server; this is only a health check.
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        bot: "stardance-slack-bot",
        commands: [`/${PREFIX}-ping`, `/${PREFIX}-help`, `/${PREFIX}-catfact`, `/${PREFIX}-joke`],
        uptime_seconds: Math.round(process.uptime()),
      })
    );
  })
  .listen(PORT, () => console.log(`health check on http://localhost:${PORT}`));

// ---------------------------------------------------------------------------
// Start the bot
// ---------------------------------------------------------------------------
(async () => {
  await app.start();
  console.log("⚡️ bot is running!");
})();
