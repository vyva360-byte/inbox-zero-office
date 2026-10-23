/**
 * Pure shift simulation. No database access, no clock reads: given the room's
 * immutable inputs and "now", it rebuilds spawning, processing, expiry, health
 * and revenue from timestamps. The server calls it on every read, and it can be
 * exercised at any point in the shift without waiting in real time.
 */

import {
  PROCESS_MS,
  ROUTE_BOOST_MS,
  SHIFT_MS,
  START_HEALTH,
  STAMPS,
  type Stamp,
} from "./gameTypes";

const SUBJECTS: Record<Stamp, string[]> = {
  support: [
    'My password is "password" and it stopped working',
    "I turned it off and on 40 times. It's worse now.",
    "The Wi-Fi knows my name and fears me",
    "My screen is upside down and so is my day",
    "I deleted the internet shortcut. All of it.",
    "The mouse only moves when nobody is watching",
    "I replied-all to the entire company. Again.",
    "My laptop fan sounds like it is taking off",
    "The captcha says I'm a robot and honestly, fair",
    "I spilled coffee in the keyboard. It types by itself now",
    "Two-factor code went to a phone I lost in 2019",
    "The update said 2 minutes. That was Tuesday.",
  ],
  billing: [
    "Charged twice for one coffee",
    "Invoice says $0.00 and somehow also $900",
    "Refund requested by a man named Definitely Real",
    "Our card declined while buying a card reader",
    "Subscription renewed for a team of one",
    "The discount code discounted us. We owe them money now",
    "Payment went through nine times. Nine.",
    'Billing address is just the word "Chicago" repeated',
    'Client paid in "exposure." We need rent.',
    "The free trial ended and took the budget with it",
    "Receipt printed in a language nobody here speaks",
    "Auto-pay paid the wrong company. A competitor.",
  ],
  ops: [
    "The printer achieved sentience again",
    "Someone microwaved fish in the server room",
    "The 3pm meeting has no agenda and 14 attendees",
    "New hire starts Monday. It is Saturday. No laptop exists.",
    "The office plant has a calendar invite. It's recurring.",
    "The elevator is stuck between floors and also in the group chat",
    "Someone labeled the label maker",
    'The AC is set to "arctic" and nobody has the remote',
    "Fire drill scheduled during the actual fire drill",
    "The supply closet is now a podcast studio",
    "The keys are locked inside the room the keys unlock",
    "The CEO's chair squeaks at a frequency only interns can hear",
  ],
};

const PHASES = [
  {
    name: "Morning Calm",
    startMs: 0,
    intervalMs: 5000,
    timerMs: 35000,
    minValue: 20,
    maxValue: 90,
  },
  {
    name: "Getting Busy",
    startMs: 60000,
    intervalMs: 3500,
    timerMs: 30000,
    minValue: 30,
    maxValue: 140,
  },
  {
    name: "Rush Hour",
    startMs: 180000,
    intervalMs: 2500,
    timerMs: 25000,
    minValue: 50,
    maxValue: 200,
  },
  {
    name: "FIRE DRILL",
    startMs: 240000,
    intervalMs: 2000,
    timerMs: 20000,
    minValue: 60,
    maxValue: 250,
  },
] as const;

/** Hard ceiling so a room that nobody opens again cannot grow forever. */
const MAX_SCHEDULED_TICKETS = 260;

export type EngineClaim = { ticketId: number; playerId: string; at: number };
export type EngineRoute = { ticketId: number; playerId: string; at: number };

export type EngineRoom = {
  seed: number;
  startAt?: number;
  endsAt?: number;
  claims: EngineClaim[];
  routes: EngineRoute[];
};

export type SimTicket = {
  id: number;
  type: Stamp;
  subject: string;
  value: number;
  spawnAt: number;
  timerMs: number;
  deadline: number;
  claimedBy: string | null;
  claimAt: number | null;
  processEndsAt: number | null;
  routeCount: number;
  lastRoutedAt: number | null;
};

export type Simulation = {
  tickets: SimTicket[];
  health: number;
  revenue: number;
  resolvedCount: number;
  expiredCount: number;
  foldedAt: number | null;
  phaseName: string;
};

/** Deterministic PRNG, so a room's ticket list is identical for every reader. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function phaseIndexAt(elapsedMs: number): number {
  if (elapsedMs >= PHASES[3].startMs) return 3;
  if (elapsedMs >= PHASES[2].startMs) return 2;
  if (elapsedMs >= PHASES[1].startMs) return 1;
  return 0;
}

export function healthGain(value: number): number {
  if (value >= 220) return 5;
  if (value >= 150) return 4;
  if (value >= 80) return 3;
  return 2;
}

export function healthPenalty(value: number): number {
  if (value >= 220) return 8;
  if (value >= 150) return 6;
  if (value >= 80) return 5;
  return 4;
}

export function gradeFor(health: number): "S" | "A" | "B" | "C" | "D" {
  if (health >= 90) return "S";
  if (health >= 75) return "A";
  if (health >= 60) return "B";
  if (health >= 40) return "C";
  return "D";
}

export function simulateRoom(room: EngineRoom, now: number): Simulation {
  const startAt = room.startAt;
  const endsAt = room.endsAt;
  if (startAt == null || endsAt == null) {
    return {
      tickets: [],
      health: START_HEALTH,
      revenue: 0,
      resolvedCount: 0,
      expiredCount: 0,
      foldedAt: null,
      phaseName: PHASES[0].name,
    };
  }

  const claimsByTicket = new Map<number, EngineClaim>();
  for (const claim of room.claims) {
    if (!claimsByTicket.has(claim.ticketId)) claimsByTicket.set(claim.ticketId, claim);
  }

  const routesByTicket = new Map<number, { count: number; lastAt: number }>();
  for (const route of room.routes) {
    const current = routesByTicket.get(route.ticketId) ?? { count: 0, lastAt: 0 };
    current.count += 1;
    current.lastAt = Math.max(current.lastAt, route.at);
    routesByTicket.set(route.ticketId, current);
  }

  const tickets: SimTicket[] = [];
  let spawnAt = startAt;
  let id = 0;
  while (spawnAt < endsAt && id < MAX_SCHEDULED_TICKETS) {
    const phase = PHASES[phaseIndexAt(spawnAt - startAt)];
    const rand = mulberry32((room.seed ^ Math.imul(id + 1, 0x9e3779b1)) >>> 0);
    const type = STAMPS[Math.floor(rand() * STAMPS.length)];
    const subjects = SUBJECTS[type];
    const subject = subjects[Math.floor(rand() * subjects.length)];
    const rawValue = phase.minValue + rand() * (phase.maxValue - phase.minValue);
    const value = Math.round(rawValue / 10) * 10;

    const claim = claimsByTicket.get(id) ?? null;
    const route = routesByTicket.get(id) ?? null;
    const boost = route ? route.count * ROUTE_BOOST_MS : 0;

    tickets.push({
      id,
      type,
      subject,
      value,
      spawnAt,
      timerMs: phase.timerMs,
      deadline: spawnAt + phase.timerMs + boost,
      claimedBy: claim?.playerId ?? null,
      claimAt: claim?.at ?? null,
      processEndsAt: claim ? claim.at + PROCESS_MS : null,
      routeCount: route?.count ?? 0,
      lastRoutedAt: route?.lastAt ?? null,
    });

    spawnAt += phase.intervalMs;
    id += 1;
  }

  const events = tickets
    .map((ticket) =>
      ticket.claimAt != null
        ? { at: ticket.claimAt + PROCESS_MS, kind: "resolve" as const, ticket }
        : { at: ticket.deadline, kind: "expire" as const, ticket },
    )
    .sort((a, b) => a.at - b.at || a.ticket.id - b.ticket.id);

  let health = START_HEALTH;
  let revenue = 0;
  let resolvedCount = 0;
  let expiredCount = 0;
  let foldedAt: number | null = null;

  const cutoff = Math.min(now, endsAt);
  for (const event of events) {
    if (event.at > cutoff) break;
    if (event.kind === "resolve") {
      revenue += event.ticket.value;
      health = Math.min(100, health + healthGain(event.ticket.value));
      resolvedCount += 1;
    } else {
      health = Math.max(0, health - healthPenalty(event.ticket.value));
      expiredCount += 1;
    }
    if (health <= 0) {
      foldedAt = event.at;
      break;
    }
  }

  const elapsed = Math.max(0, Math.min(now - startAt, SHIFT_MS));
  return {
    tickets,
    health,
    revenue,
    resolvedCount,
    expiredCount,
    foldedAt,
    phaseName: PHASES[phaseIndexAt(elapsed)].name,
  };
}
