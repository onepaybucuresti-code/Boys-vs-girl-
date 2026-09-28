import express from "express";
import { WebSocketServer } from "ws";
import { TikTokLive } from "tiktok-live-events";
import http from "http";

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 10000;
const TIKTOK_USERNAME = process.env.TIKTOK_USERNAME || "neagoemarius";

let scores = { boys: 0, girls: 0 };
const clients = new Set();

function broadcastScore() {
  const msg = JSON.stringify({ type: "score", ...scores });
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

app.get("/", (_req, res) => res.json({ ok: true, tiktok: TIKTOK_USERNAME, scores }));
app.get("/score", (_req, res) => res.json(scores));

app.post("/reset", express.json(), (_req, res) => {
  scores = { boys: 0, girls: 0 };
  broadcastScore();
  res.json({ ok: true, scores });
});

wss.on("connection", (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "score", ...scores }));
  ws.on("close", () => clients.delete(ws));
});

async function connectTikTok() {
  const live = new TikTokLive(TIKTOK_USERNAME);

  live.on("connected", () => console.log(`Connected to @${TIKTOK_USERNAME}`));

  live.on("gift", (e) => {
    const name = String(e.giftName || "").trim().toLowerCase();
    const count = Number(e.repeatCount || 1);

    // Ignore intermediate streak events; count the completed streak once.
    if (e.streaking === true) return;

    if (name === "rose") {
      scores.boys += count;
      console.log(`ROSE x${count} -> BOYS ${scores.boys}`);
      broadcastScore();
    } else if (name === "donut" || name === "doughnut") {
      scores.girls += count;
      console.log(`DONUT x${count} -> GIRLS ${scores.girls}`);
      broadcastScore();
    }
  });

  live.on("error", (err) => console.error("TikTok error:", err?.message || err));

  try {
    await live.connect();
  } catch (err) {
    console.error("TikTok connection failed:", err?.message || err);
    setTimeout(connectTikTok, 10000);
  }
}

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
  connectTikTok();
});
