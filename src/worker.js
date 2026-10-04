import { band, distance, isValidPoint, randomCode } from "./logic.js";
import { PAGE_HTML } from "./page.js";

const ROOM_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_RE = /^[A-Z0-9]{6}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && (path === "/" || path === "/index.html")) {
      return new Response(PAGE_HTML, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (request.method === "POST" && path === "/api/rooms") {
      const code = randomCode();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const r = await stub.fetch("https://room/create", { method: "POST" });
      if (!r.ok) return r;
      return json({ code });
    }

    const m = path.match(/^\/api\/rooms\/([^/]+)(\/submit|\/reveal)?$/);
    if (m) {
      const code = m[1].toUpperCase();
      if (!CODE_RE.test(code)) return json({ error: "Invalid round code." }, 400);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const action = m[2] ? m[2].slice(1) : "status";
      const inner = new URL(`https://room/${action}`);
      inner.search = url.search;
      return stub.fetch(inner, {
        method: request.method,
        headers: request.headers,
        body: request.method === "POST" ? request.body : undefined,
      });
    }

    return json({ error: "Not found." }, 404);
  },
};

// One Durable Object per round. It is the only place that ever sees both positions.
export class Room {
  constructor(state) {
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const action = url.pathname.slice(1);
    const room = await this.storage.get("room");

    if (action === "create" && request.method === "POST") {
      if (room) return json({ error: "Round already exists." }, 409);
      await this.storage.put("room", { createdAt: Date.now(), players: [] });
      await this.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return json({ ok: true });
    }

    if (!room) return json({ error: "No such round." }, 404);

    if (action === "submit" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Bad request." }, 400);
      }
      const pos = { x: body?.x, y: body?.y };
      if (!isValidPoint(pos)) return json({ error: "Position must be inside the map." }, 400);
      if (room.players.length >= 2) {
        return json({ error: "Both players have already submitted for this round." }, 409);
      }
      const token = crypto.randomUUID();
      room.players.push({ token, pos, wantsReveal: false });
      await this.storage.put("room", room);
      return json({ token });
    }

    const token = url.searchParams.get("token") || (await this.tokenFromBody(request));
    const me = room.players.findIndex((p) => p.token === token);

    if (action === "reveal" && request.method === "POST") {
      if (me < 0) return json({ error: "You are not a player in this round." }, 403);
      if (room.players.length < 2) return json({ error: "Waiting for the other player." }, 409);
      room.players[me].wantsReveal = true;
      await this.storage.put("room", room);
      return json(this.status(room, me));
    }

    if (action === "status" && request.method === "GET") {
      return json(this.status(room, me));
    }

    return json({ error: "Not found." }, 404);
  }

  async tokenFromBody(request) {
    if (request.method !== "POST") return null;
    try {
      return (await request.json())?.token ?? null;
    } catch {
      return null;
    }
  }

  // Never includes the other player's position unless both asked for the reveal.
  status(room, me) {
    const out = { submitted: room.players.length, isPlayer: me >= 0 };
    if (me < 0 || room.players.length < 2) return out;

    const mine = room.players[me];
    const other = room.players[1 - me];
    const b = band(mine.pos, other.pos);
    out.result = b === "close" ? "reroll" : b;
    out.revealVotes = { you: mine.wantsReveal, other: other.wantsReveal };
    if (mine.wantsReveal && other.wantsReveal) {
      out.reveal = { you: mine.pos, other: other.pos, distance: distance(mine.pos, other.pos) };
    }
    return out;
  }

  async alarm() {
    await this.storage.deleteAll();
  }
}
