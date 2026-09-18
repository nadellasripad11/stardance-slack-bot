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
  ["trivia", "a random multiple-choice trivia question"],
  ["number [n]", "an interesting fact about a number, e.g. `42`"],
  ["rps rock|paper|scissors", "play rock-paper-scissors with the bot"],
  ["fact", "a random useless (but true) fact"],
  ["country <name>", "quick facts about a country, e.g. `japan`"],
  ["morse <text>", "encode text in morse code (offline)"],
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
  const POS = { n: "noun", v: "verb", adj: "adjective", adv: "adverb", u: "" };
  try {
    // Datamuse: fast, no API key. `md=d` adds definitions as "pos<TAB>text".
    const data = await httpGet(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`
    );
    const entry = data[0];
    if (!entry || !entry.defs || entry.defs.length === 0) {
      await respond({ text: `No definition found for "${word}".` });
      return;
    }
    const lines = entry.defs.slice(0, 3).map((d) => {
      const tab = d.indexOf("\t");
      const pos = tab === -1 ? "" : d.slice(0, tab);
      const text = (tab === -1 ? d : d.slice(tab + 1)).trim();
      const label = POS[pos] !== undefined ? POS[pos] : pos;
      return label ? `_(${label})_ ${text}` : text;
    });
    await respond(inChannel(`:book: *${entry.word}*\n${lines.join("\n")}`));
  } catch (err) {
    console.error("define failed:", err.message);
    await respond({ text: `Couldn't fetch a definition for "${word}".` });
  }
});

// ---------------------------------------------------------------------------
// Trivia (Open Trivia DB — free, no key)
// ---------------------------------------------------------------------------

// opentdb encodes special chars as HTML entities; decode the common ones.
function decodeHtml(str) {
  return String(str)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&lsquo;/g, "‘")
    .replace(/&rsquo;/g, "’")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&deg;/g, "°");
}

// Shuffle an array in place (Fisher-Yates).
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

app.command(`/${PREFIX}-trivia`, async ({ ack, respond }) => {
  await ack();
  try {
    const data = await httpGet("https://opentdb.com/api.php?amount=1&type=multiple");
    if (!data.results || data.results.length === 0) throw new Error("empty response");
    const q = data.results[0];
    const question = decodeHtml(q.question);
    const correct = decodeHtml(q.correct_answer);
    const options = shuffle([correct, ...q.incorrect_answers.map(decodeHtml)]);
    const labels = ["🇦", "🇧", "🇨", "🇩"];
    const optionLines = options.map((opt, i) => `${labels[i]} ${opt}`).join("\n");
    const correctLabel = labels[options.indexOf(correct)];
    const diff = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);
    const text =
      `:brain: *Trivia* · _${decodeHtml(q.category)}_ · ${diff}\n\n` +
      `*${question}*\n\n${optionLines}\n\n||${correctLabel} ${correct}||`;
    await respond(inChannel(text));
  } catch (err) {
    console.error("trivia failed:", err.message);
    await respond({ text: "Couldn't fetch a trivia question. Try again in a moment." });
  }
});

// ---------------------------------------------------------------------------
// Number facts (numbersapi.com — free, no key)
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-number`, async ({ command, ack, respond }) => {
  await ack();
  const arg = (command.text || "").trim();
  const target = /^\d+$/.test(arg) ? arg : "random";
  try {
    const fact = await httpGet(`http://numbersapi.com/${target}`, {
      responseType: "text",
      headers: { "User-Agent": "curl" },
    });
    await respond(inChannel(`:1234: ${String(fact).trim()}`));
  } catch (err) {
    console.error("number failed:", err.message);
    await respond({ text: "Couldn't fetch a number fact. Try again in a moment." });
  }
});

// ---------------------------------------------------------------------------
// Rock-paper-scissors (offline)
// ---------------------------------------------------------------------------
const RPS_CHOICES = ["rock", "paper", "scissors"];
const RPS_EMOJI = { rock: ":rock:", paper: ":page_facing_up:", scissors: ":scissors:" };
const RPS_BEATS = { rock: "scissors", paper: "rock", scissors: "paper" };

app.command(`/${PREFIX}-rps`, async ({ command, ack, respond }) => {
  await ack();
  const player = (command.text || "").trim().toLowerCase();
  if (!RPS_CHOICES.includes(player)) {
    await respond({ text: `Usage: \`/${PREFIX}-rps rock|paper|scissors\`` });
    return;
  }
  const bot = RPS_CHOICES[Math.floor(Math.random() * 3)];
  const pe = RPS_EMOJI[player];
  const be = RPS_EMOJI[bot];
  let result;
  if (player === bot) result = "It's a tie! 🤝";
  else if (RPS_BEATS[player] === bot) result = "You win! 🎉";
  else result = "Bot wins! 🤖";
  await respond(inChannel(`${pe} vs ${be} — ${result}`));
});

// ---------------------------------------------------------------------------
// Random fact (uselessfacts.jsph.pl — free, no key)
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-fact`, async ({ ack, respond }) => {
  await ack();
  try {
    const data = await httpGet("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en");
    await respond(inChannel(`:bulb: ${data.text}`));
  } catch (err) {
    console.error("fact failed:", err.message);
    await respond({ text: "Couldn't fetch a fact. Try again in a moment." });
  }
});

// ---------------------------------------------------------------------------
// Country info (restcountries.com — free, no key)
// ---------------------------------------------------------------------------
app.command(`/${PREFIX}-country`, async ({ command, ack, respond }) => {
  await ack();
  const name = (command.text || "").trim();
  if (!name) {
    await respond({ text: `Usage: \`/${PREFIX}-country <name>\` — e.g. \`/${PREFIX}-country japan\`` });
    return;
  }
  try {
    const data = await httpGet(
      `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=name,capital,region,population,languages,currencies,flag`
    );
    const c = data[0];
    const capital = (c.capital || ["?"])[0];
    const pop = c.population.toLocaleString("en-US");
    const langs = Object.values(c.languages || {}).join(", ") || "?";
    const currencies = Object.values(c.currencies || {})
      .map((cur) => `${cur.name} (${cur.symbol || "?"})`)
      .join(", ") || "?";
    const text =
      `${c.flag || ":earth_americas:"} *${c.name.common}* · ${c.region}\n` +
      `Capital: ${capital} · Population: ${pop}\n` +
      `Languages: ${langs}\n` +
      `Currency: ${currencies}`;
    await respond(inChannel(text));
  } catch (err) {
    console.error("country failed:", err.message);
    await respond({ text: `Couldn't find info for "${name}". Check the spelling and try again.` });
  }
});

// ---------------------------------------------------------------------------
// Morse code encoder (offline — never fails)
// ---------------------------------------------------------------------------
const MORSE = {
  A:".-", B:"-...", C:"-.-.", D:"-..", E:".", F:"..-.", G:"--.", H:"....",
  I:"..", J:".---", K:"-.-", L:".-..", M:"--", N:"-.", O:"---", P:".--.",
  Q:"--.-", R:".-.", S:"...", T:"-", U:"..-", V:"...-", W:".--", X:"-..-",
  Y:"-.--", Z:"--..",
  "0":"-----", "1":".----", "2":"..---", "3":"...--", "4":"....-",
  "5":".....", "6":"-....", "7":"--...", "8":"---..", "9":"----.",
  ".":".-.-.-", ",":"--..--", "?":"..--..", "!":"-.-.--", "/":"-..-.",
  "-":"-....-", "'":".----.", "(":"-.--.", ")":"-.--.-",
};

app.command(`/${PREFIX}-morse`, async ({ command, ack, respond }) => {
  await ack();
  const text = (command.text || "").trim();
  if (!text) {
    await respond({ text: `Usage: \`/${PREFIX}-morse <text>\` — e.g. \`/${PREFIX}-morse hello world\`` });
    return;
  }
  const encoded = text
    .toUpperCase()
    .split("")
    .map((ch) => (ch === " " ? "/" : (MORSE[ch] || "?")))
    .join(" ");
  await respond(inChannel(`:radio: \`${text}\`\n\`${encoded}\``));
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
