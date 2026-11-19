// The Charleston trainer's game flow. You sit East; the other three seats are bots.

import { tileName } from "./Tile";
import {
  PRACTICE_CARD,
  blindPass,
  choosePass,
  courtesyPass,
  deal,
  reviewPass,
  pass,
  SEATS,
  type BlindChoice,
  type Direction,
  type Hands,
  type PassReview,
  type Seat,
  type Tile,
} from "@mahjong-coach/engine";

export const CARD = PRACTICE_CARD;
export const ME: Seat = "east";

export type Step =
  | { kind: "pass"; charleston: 1 | 2; index: 1 | 2 | 3; direction: Direction; blind: boolean }
  | { kind: "vote" }
  | { kind: "courtesy" }
  | { kind: "done" };

export const STEPS: readonly Step[] = [
  { kind: "pass", charleston: 1, index: 1, direction: "right", blind: false },
  { kind: "pass", charleston: 1, index: 2, direction: "across", blind: false },
  { kind: "pass", charleston: 1, index: 3, direction: "left", blind: true },
  { kind: "vote" },
  { kind: "pass", charleston: 2, index: 1, direction: "left", blind: false },
  { kind: "pass", charleston: 2, index: 2, direction: "across", blind: false },
  { kind: "pass", charleston: 2, index: 3, direction: "right", blind: true },
  { kind: "courtesy" },
  { kind: "done" },
];
const COURTESY = STEPS.findIndex((s) => s.kind === "courtesy");

export interface LogEntry {
  readonly label: string;
  readonly handBefore: readonly Tile[];
  readonly passed: readonly Tile[];
  readonly blind: number;
  readonly received: readonly Tile[];
  readonly review: PassReview | null;
}

export interface Game {
  readonly seed: number;
  readonly hands: Hands;
  readonly step: number;
  readonly log: readonly LogEntry[];
  /** Tiles that just arrived in your hand, to highlight. */
  readonly fresh: ReadonlySet<number>;
  readonly playedSecond: boolean | null;
}

export function handName(id: string): string {
  const def = CARD.hands.find((h) => h.id === id);
  if (!def) return id;
  const n = id.split("-")[1];
  return `${def.section} ${n}`;
}

export function stepLabel(step: Step): string {
  if (step.kind === "pass") {
    const which = step.charleston === 1 ? "First Charleston" : "Second Charleston";
    return `${which}, pass ${step.index} of 3`;
  }
  if (step.kind === "vote") return "Second Charleston?";
  if (step.kind === "courtesy") return "Courtesy pass";
  return "Charleston review";
}

export function newGame(seed: number): Game {
  return { seed, hands: deal(seed).hands, step: 0, log: [], fresh: new Set(), playedSecond: null };
}

export function currentStep(game: Game): Step {
  return STEPS[game.step]!;
}

function arrived(before: readonly Tile[], after: readonly Tile[]): Tile[] {
  const had = new Set(before.map((t) => t.id));
  return after.filter((t) => !had.has(t.id));
}

/** You pass `ownIds` from your hand plus `blind` incoming tiles unseen. The bots pick their own 3. */
export function submitPass(game: Game, ownIds: readonly number[], blind: number): Game {
  const step = currentStep(game);
  if (step.kind !== "pass") throw new Error("not a passing step");
  const before = game.hands[ME];

  let after: Hands;
  if (step.blind) {
    const choices = {} as Record<Seat, BlindChoice>;
    for (const seat of SEATS) {
      choices[seat] =
        seat === ME
          ? { own: ownIds, blind: blind as 0 | 1 | 2 | 3 }
          : { own: choosePass(game.hands[seat], CARD), blind: 0 };
    }
    after = blindPass(game.hands, choices, step.direction);
  } else {
    const picks = {} as Record<Seat, readonly number[]>;
    for (const seat of SEATS) picks[seat] = seat === ME ? ownIds : choosePass(game.hands[seat], CARD);
    after = pass(game.hands, picks, step.direction);
  }

  const received = arrived(before, after[ME]);
  const entry: LogEntry = {
    label: `${stepLabel(step)} · ${step.direction}`,
    handBefore: before,
    passed: before.filter((t) => ownIds.includes(t.id)),
    blind,
    received,
    review: ownIds.length > 0 ? reviewPass(before, ownIds, CARD, handName, (t) => tileName(t.kind)) : null,
  };
  return { ...game, hands: after, step: game.step + 1, log: [...game.log, entry], fresh: new Set(received.map((t) => t.id)) };
}

/** Bots always want the second Charleston, so your vote decides. */
export function vote(game: Game, playSecond: boolean): Game {
  return { ...game, playedSecond: playSecond, step: playSecond ? game.step + 1 : COURTESY, fresh: new Set() };
}

/** How many tiles West (the bot across from you) offers in the courtesy pass. */
export const WEST_OFFER = 2;

export function submitCourtesy(game: Game, ownIds: readonly number[]): Game {
  const before = game.hands[ME];
  const offers = {} as Record<Seat, readonly number[]>;
  for (const seat of SEATS) offers[seat] = seat === ME ? ownIds : choosePass(game.hands[seat], CARD, WEST_OFFER);
  const after = courtesyPass(game.hands, offers);
  const traded = Math.min(ownIds.length, WEST_OFFER);
  const passedIds = ownIds.slice(0, traded);
  const received = arrived(before, after[ME]);
  const entry: LogEntry = {
    label: `Courtesy pass · across`,
    handBefore: before,
    passed: before.filter((t) => passedIds.includes(t.id)),
    blind: 0,
    received,
    review: passedIds.length > 0 ? reviewPass(before, passedIds, CARD, handName, (t) => tileName(t.kind)) : null,
  };
  return { ...game, hands: after, step: game.step + 1, log: [...game.log, entry], fresh: new Set(received.map((t) => t.id)) };
}

/** Rack order: bams, craks, dots, winds, dragons, flowers, jokers. */
export function sortTiles(tiles: readonly Tile[]): Tile[] {
  const order = (t: Tile) => {
    const k = t.kind;
    switch (k.type) {
      case "suit":
        return ["bam", "crak", "dot"].indexOf(k.suit) * 10 + k.rank;
      case "wind":
        return 40 + "NESW".indexOf(k.wind);
      case "dragon":
        return 50 + ["red", "green", "white"].indexOf(k.dragon);
      case "flower":
        return 60;
      case "joker":
        return 70;
    }
  };
  return [...tiles].sort((a, b) => order(a) - order(b) || a.id - b.id);
}
