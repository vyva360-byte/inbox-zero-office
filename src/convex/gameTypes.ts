/**
 * Shared game types and timing constants.
 *
 * This file is deliberately free of Convex server imports so the React app can
 * import it for the numbers used by the countdown bars and progress ring.
 */

export type Stamp = "support" | "billing" | "ops";
export type Phase = "lobby" | "live" | "over";
export type TicketState = "open" | "processing";

export const STAMPS: Stamp[] = ["support", "billing", "ops"];

/** Length of a shift. */
export const SHIFT_MS = 5 * 60 * 1000;
/** Time a ticket spends on a player's desk before it counts as cleared. */
export const PROCESS_MS = 2500;
/** Extra time a route adds to a ticket's timer. */
export const ROUTE_BOOST_MS = 5000;
/** How often the same ticket can be routed. */
export const ROUTE_COOLDOWN_MS = 10000;
export const START_HEALTH = 70;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

export type TicketView = {
  id: number;
  type: Stamp;
  subject: string;
  value: number;
  spawnAt: number;
  deadline: number;
  state: TicketState;
  claimedBy: string | null;
  claimAt: number | null;
  processEndsAt: number | null;
  routeCount: number;
  lastRoutedAt: number | null;
};

export type PlayerView = {
  id: string;
  name: string;
  stamps: Stamp[];
  isHost: boolean;
  /** The ticket this player is currently clearing, if any. */
  processingTicketId: number | null;
};

export type RoomView = {
  code: string;
  phase: Phase;
  hostId: string;
  players: PlayerView[];
  /** Open and in-progress tickets, newest first. */
  tickets: TicketView[];
  health: number;
  revenue: number;
  resolvedCount: number;
  expiredCount: number;
  startAt: number | null;
  endsAt: number | null;
  /** When Company Health hit zero, if it did. */
  foldedAt: number | null;
  grade: "S" | "A" | "B" | "C" | "D" | null;
  chaos: boolean;
  phaseName: string;
  /** Server clock at the moment this snapshot was built. */
  now: number;
};

export type JoinResult =
  | { ok: true; code: string }
  | { ok: false; reason: "not_found" | "started" | "full" };

export type ActionFailure =
  | "taken"
  | "expired"
  | "wrong_stamp"
  | "busy"
  | "cooldown"
  | "own_stamp"
  | "not_active"
  | "not_in_room"
  | "not_host"
  | "need_players"
  | "already_started"
  | "gone";

export type ActionResult =
  | { ok: true; ticketId?: number }
  | { ok: false; reason: ActionFailure; retryInMs?: number };
