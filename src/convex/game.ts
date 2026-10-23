import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { gradeFor, simulateRoom, type SimTicket } from "./gameEngine";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PROCESS_MS,
  ROUTE_COOLDOWN_MS,
  SHIFT_MS,
  STAMPS,
  type ActionResult,
  type JoinResult,
  type Phase,
  type RoomView,
  type Stamp,
  type TicketView,
} from "./gameTypes";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim().slice(0, 14);
  return cleaned.length > 0 ? cleaned : "Staffer";
}

function randomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

function dealStamps(
  players: Doc<"rooms">["players"],
  offset: number,
): Doc<"rooms">["players"] {
  const count = players.length;
  return players.map((player, index) => {
    let stamps: Stamp[];
    if (count <= 1) {
      stamps = [STAMPS[offset % STAMPS.length]];
    } else if (count === 2) {
      // 2 players: stamps split 2 + 1, always covering all three types.
      const firstDeal = offset % 2 === 0;
      if (index === 0) {
        stamps = firstDeal ? ["support", "billing"] : ["billing", "ops"];
      } else {
        stamps = firstDeal ? ["ops"] : ["support"];
      }
    } else {
      stamps = [STAMPS[(index + offset) % STAMPS.length]];
    }
    return { ...player, stamps };
  });
}

async function findRoom(ctx: QueryCtx | MutationCtx, code: string) {
  const normalized = code.trim().toUpperCase();
  if (normalized.length === 0) return null;
  return await ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", normalized))
    .unique();
}

async function generateRoomCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = randomCode();
    const existing = await findRoom(ctx, code);
    if (existing === null) return code;
  }
  return `${randomCode().slice(0, 3)}${Math.floor(Math.random() * 10)}`;
}

function toTicketView(ticket: SimTicket): TicketView {
  return {
    id: ticket.id,
    type: ticket.type,
    subject: ticket.subject,
    value: ticket.value,
    spawnAt: ticket.spawnAt,
    deadline: ticket.deadline,
    state: ticket.claimedBy != null ? "processing" : "open",
    claimedBy: ticket.claimedBy,
    claimAt: ticket.claimAt,
    processEndsAt: ticket.processEndsAt,
    routeCount: ticket.routeCount,
    lastRoutedAt: ticket.lastRoutedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Reading the room                                                    */
/* ------------------------------------------------------------------ */

export const getRoom = query({
  args: { code: v.string(), pulse: v.optional(v.number()) },
  handler: async (ctx, args): Promise<RoomView | null> => {
    const room = await findRoom(ctx, args.code);
    if (room === null) return null;

    const now = Date.now();
    const sim = simulateRoom(room, now);

    const started = room.startAt != null && room.endsAt != null;
    const over = started && (sim.foldedAt != null || now >= (room.endsAt ?? 0));
    const phase: Phase = !started ? "lobby" : over ? "over" : "live";

    const tickets =
      phase === "live"
        ? sim.tickets
            .filter((ticket) =>
              ticket.claimedBy != null
                ? now < (ticket.processEndsAt ?? 0)
                : now >= ticket.spawnAt && now < ticket.deadline,
            )
            .sort((a, b) => b.spawnAt - a.spawnAt)
            .map((ticket) => toTicketView(ticket))
        : [];

    const players = room.players.map((player) => {
      let processingTicketId: number | null = null;
      for (const claim of room.claims) {
        if (claim.playerId === player.id && claim.at + PROCESS_MS > now) {
          processingTicketId = claim.ticketId;
        }
      }
      return {
        id: player.id,
        name: player.name,
        stamps: player.stamps,
        isHost: player.id === room.hostId,
        processingTicketId,
      };
    });

    return {
      code: room.code,
      phase,
      hostId: room.hostId,
      players,
      tickets,
      health: sim.health,
      revenue: sim.revenue,
      resolvedCount: sim.resolvedCount,
      expiredCount: sim.expiredCount,
      startAt: room.startAt ?? null,
      endsAt: room.endsAt ?? null,
      foldedAt: sim.foldedAt,
      grade: phase === "over" ? gradeFor(sim.health) : null,
      chaos: phase === "over" && sim.health < 25,
      phaseName: phase === "lobby" ? "Morning Calm" : sim.phaseName,
      now,
    };
  },
});

/* ------------------------------------------------------------------ */
/* Room lifecycle                                                      */
/* ------------------------------------------------------------------ */

export const createRoom = mutation({
  args: { playerId: v.string(), name: v.string() },
  handler: async (ctx, args): Promise<string> => {
    const code = await generateRoomCode(ctx);
    const now = Date.now();
    const name = sanitizeName(args.name);
    const players = dealStamps(
      [{ id: args.playerId, name, stamps: [], joinedAt: now }],
      0,
    );
    await ctx.db.insert("rooms", {
      code,
      seed: (Math.random() * 0x7fffffff) ^ (now & 0x7fffffff),
      hostId: args.playerId,
      players,
      claims: [],
      routes: [],
      dealOffset: 0,
      createdAt: now,
    });
    return code;
  },
});

export const joinRoom = mutation({
  args: { code: v.string(), playerId: v.string(), name: v.string() },
  handler: async (ctx, args): Promise<JoinResult> => {
    const room = await findRoom(ctx, args.code);
    if (room === null) return { ok: false, reason: "not_found" };

    const now = Date.now();
    const started = room.startAt != null;
    const existing = room.players.find((player) => player.id === args.playerId);
    if (existing === undefined && started) return { ok: false, reason: "started" };
    if (existing === undefined && room.players.length >= MAX_PLAYERS) {
      return { ok: false, reason: "full" };
    }

    const name = sanitizeName(args.name);
    let players = existing
      ? room.players.map((player) =>
          player.id === args.playerId ? { ...player, name } : player,
        )
      : [
          ...room.players,
          {
            id: args.playerId,
            name,
            stamps: [] as Stamp[],
            joinedAt: now,
          },
        ];

    // Keep every stamp covered whenever the lobby changes.
    if (room.startAt == null) {
      players = dealStamps(players, room.dealOffset);
    }

    await ctx.db.patch(room._id, { players });
    return { ok: true, code: room.code };
  },
});

export const rerollStamps = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, args): Promise<ActionResult> => {
    const room = await findRoom(ctx, args.code);
    if (room === null) return { ok: false, reason: "not_active" };
    if (room.hostId !== args.playerId) return { ok: false, reason: "not_host" };
    if (room.startAt != null) return { ok: false, reason: "already_started" };

    const dealOffset = room.dealOffset + 1;
    const players = dealStamps(room.players, dealOffset);
    await ctx.db.patch(room._id, { dealOffset, players });
    return { ok: true };
  },
});

export const startShift = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, args): Promise<ActionResult> => {
    const room = await findRoom(ctx, args.code);
    if (room === null) return { ok: false, reason: "not_active" };
    if (room.hostId !== args.playerId) return { ok: false, reason: "not_host" };
    if (room.startAt != null) return { ok: false, reason: "already_started" };
    if (room.players.length < MIN_PLAYERS) {
      return { ok: false, reason: "need_players" };
    }

    const now = Date.now();
    const players = dealStamps(room.players, room.dealOffset);
    await ctx.db.patch(room._id, {
      players,
      claims: [],
      routes: [],
      seed: (Math.random() * 0x7fffffff) ^ (now & 0x7fffffff),
      startAt: now,
      endsAt: now + SHIFT_MS,
    });
    return { ok: true };
  },
});

export const claimTicket = mutation({
  args: { code: v.string(), playerId: v.string(), ticketId: v.number() },
  handler: async (ctx, args): Promise<ActionResult> => {
    const room = await findRoom(ctx, args.code);
    if (room === null || room.startAt == null || room.endsAt == null) {
      return { ok: false, reason: "not_active" };
    }

    const now = Date.now();
    if (now >= room.endsAt) return { ok: false, reason: "not_active" };

    const sim = simulateRoom(room, now);
    if (sim.foldedAt != null) return { ok: false, reason: "not_active" };

    const player = room.players.find((candidate) => candidate.id === args.playerId);
    if (player === undefined) return { ok: false, reason: "not_in_room" };

    const ticket = sim.tickets.find((candidate) => candidate.id === args.ticketId);
    if (ticket === undefined || ticket.spawnAt > now) {
      return { ok: false, reason: "gone" };
    }
    // Conditional claim: whoever gets here second is told it is taken.
    if (ticket.claimedBy != null) {
      return { ok: false, reason: ticket.claimedBy === player.id ? "busy" : "taken" };
    }
    if (now >= ticket.deadline) return { ok: false, reason: "expired" };
    if (!player.stamps.includes(ticket.type)) {
      return { ok: false, reason: "wrong_stamp" };
    }

    // One ticket on a desk at a time.
    const alreadyProcessing = room.claims.some(
      (claim) => claim.playerId === player.id && claim.at + PROCESS_MS > now,
    );
    if (alreadyProcessing) return { ok: false, reason: "busy" };

    await ctx.db.patch(room._id, {
      claims: [...room.claims, { ticketId: ticket.id, playerId: player.id, at: now }],
    });
    return { ok: true, ticketId: ticket.id };
  },
});

export const routeTicket = mutation({
  args: { code: v.string(), playerId: v.string(), ticketId: v.number() },
  handler: async (ctx, args): Promise<ActionResult> => {
    const room = await findRoom(ctx, args.code);
    if (room === null || room.startAt == null || room.endsAt == null) {
      return { ok: false, reason: "not_active" };
    }

    const now = Date.now();
    if (now >= room.endsAt) return { ok: false, reason: "not_active" };

    const sim = simulateRoom(room, now);
    if (sim.foldedAt != null) return { ok: false, reason: "not_active" };

    const player = room.players.find((candidate) => candidate.id === args.playerId);
    if (player === undefined) return { ok: false, reason: "not_in_room" };

    const ticket = sim.tickets.find((candidate) => candidate.id === args.ticketId);
    if (ticket === undefined || ticket.spawnAt > now) {
      return { ok: false, reason: "gone" };
    }
    if (ticket.claimedBy != null) return { ok: false, reason: "taken" };
    if (now >= ticket.deadline) return { ok: false, reason: "expired" };
    if (player.stamps.includes(ticket.type)) {
      return { ok: false, reason: "own_stamp" };
    }
    if (ticket.lastRoutedAt != null) {
      const retryInMs = ticket.lastRoutedAt + ROUTE_COOLDOWN_MS - now;
      if (retryInMs > 0) return { ok: false, reason: "cooldown", retryInMs };
    }

    await ctx.db.patch(room._id, {
      routes: [...room.routes, { ticketId: ticket.id, playerId: player.id, at: now }],
    });
    return { ok: true, ticketId: ticket.id };
  },
});

export const playAgain = mutation({
  args: { code: v.string(), playerId: v.string() },
  handler: async (ctx, args): Promise<ActionResult> => {
    const room = await findRoom(ctx, args.code);
    if (room === null) return { ok: false, reason: "not_active" };
    if (!room.players.some((player) => player.id === args.playerId)) {
      return { ok: false, reason: "not_in_room" };
    }
    if (room.startAt == null || room.endsAt == null) {
      return { ok: false, reason: "not_active" };
    }
    const now = Date.now();
    if (now < room.endsAt && simulateRoom(room, now).foldedAt == null) {
      return { ok: false, reason: "not_active" };
    }

    const players = dealStamps(room.players, room.dealOffset);
    await ctx.db.patch(room._id, {
      players,
      claims: [],
      routes: [],
      seed: (Math.random() * 0x7fffffff) ^ (Date.now() & 0x7fffffff),
      startAt: undefined,
      endsAt: undefined,
    });
    return { ok: true };
  },
});
