import { closestDistinct, choosePass, expandHand, seatTo, type HandDistance, type Tile } from "@mahjong-coach/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CARD,
  ME,
  WEST_OFFER,
  currentStep,
  handName,
  newGame,
  sortTiles,
  stepLabel,
  submitCourtesy,
  submitPass,
  vote,
  type Game,
  type LogEntry,
} from "./game";
import { TileView, tileName } from "./Tile";

const SEAT_NAME = { east: "East", south: "South", west: "West", north: "North" } as const;
const RATING_LABEL = { great: "Great", fine: "Fine", missed: "Missed chance", costly: "Costly" } as const;

function initialSeed(): number {
  const fromUrl = Number(new URLSearchParams(location.search).get("deal"));
  return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : Math.floor(Math.random() * 99999) + 1;
}

export function App() {
  const [game, setGame] = useState<Game>(() => newGame(initialSeed()));
  const [coaching, setCoaching] = useState(false);
  const [seenNudge, setSeenNudge] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const hand = game.hands[ME];
  const arranged = useMemo(() => arrange(order, hand), [order, hand]);
  // Remember where new tiles landed, so your arrangement carries into the next pass.
  useEffect(() => setOrder(arranged.map((t) => t.id)), [hand]); // eslint-disable-line react-hooks/exhaustive-deps
  const rack: Arrangement = {
    tiles: arranged,
    onReorder: setOrder,
    onSort: () => setOrder(sortTiles(hand).map((t) => t.id)),
  };

  const step = currentStep(game);
  const last = game.log.at(-1);
  const showNudge = coaching && last?.review && seenNudge < game.log.length && step.kind !== "done";

  const restart = (seed: number) => {
    setGame(newGame(seed));
    setSeenNudge(0);
    setOrder([]);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Mahjong Coach</p>
          <h1>Charleston trainer</h1>
        </div>
        <label className="switch">
          <input type="checkbox" checked={coaching} onChange={(e) => setCoaching(e.target.checked)} />
          <span className="switch-track" aria-hidden="true" />
          <span>Coaching {coaching ? "on" : "off"}</span>
        </label>
      </header>

      <p className="deal-line">
        Deal #{game.seed} · you sit East · practice card
      </p>

      {showNudge && last.review && (
        <aside className={`nudge rating-${last.review.rating}`} aria-live="polite">
          <div>
            <strong>{RATING_LABEL[last.review.rating]}.</strong> {last.review.reason}
          </div>
          <button type="button" className="link" onClick={() => setSeenNudge(game.log.length)}>
            Got it
          </button>
        </aside>
      )}

      {step.kind === "pass" && <PassScreen key={game.step} game={game} rack={rack} onPass={(ids, blind) => setGame(submitPass(game, ids, blind))} />}
      {step.kind === "vote" && <VoteScreen game={game} rack={rack} onVote={(yes) => setGame(vote(game, yes))} />}
      {step.kind === "courtesy" && <CourtesyScreen key={game.step} game={game} rack={rack} onPass={(ids) => setGame(submitCourtesy(game, ids))} />}
      {step.kind === "done" && <ReviewScreen game={game} rack={rack} onReplay={() => restart(game.seed)} onNew={() => restart(Math.floor(Math.random() * 99999) + 1)} />}
    </div>
  );
}

interface Arrangement {
  /** Your tiles in the order you've arranged them. */
  tiles: readonly Tile[];
  onReorder: (ids: number[]) => void;
  onSort: () => void;
}

/** Keeps your arrangement; tiles that just arrived go at the right end, like picking them up. */
function arrange(order: readonly number[], hand: readonly Tile[]): Tile[] {
  const byId = new Map(hand.map((t) => [t.id, t]));
  const kept = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  const keptIds = new Set(kept.map((t) => t.id));
  return [...kept, ...sortTiles(hand.filter((t) => !keptIds.has(t.id)))];
}

interface DragState {
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  dx: number;
  /** Has the tile been picked up (held, or slid far enough)? Before that, it's still a tap. */
  active: boolean;
  from: number;
  over: number;
  /** Centers of every slot when the drag started. Tiles don't move in the page until you let go. */
  centers: number[];
  slot: number;
}

const HOLD_MS = 200;
const SLIDE_PX = 6;

function Rack({
  arrangement,
  selected,
  hinted,
  fresh,
  onToggle,
  canSelectMore,
}: {
  arrangement: Arrangement;
  selected: ReadonlySet<number>;
  hinted: ReadonlySet<number>;
  fresh: ReadonlySet<number>;
  onToggle?: (id: number) => void;
  canSelectMore: boolean;
}) {
  const { tiles, onReorder, onSort } = arrangement;
  const rowRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const holdTimer = useRef<number | undefined>(undefined);
  const swallowClick = useRef(false);
  const ids = tiles.map((t) => t.id);

  const update = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const moveTo = (id: number, to: number) => {
    const rest = ids.filter((i) => i !== id);
    rest.splice(Math.max(0, Math.min(to, rest.length)), 0, id);
    onReorder(rest);
  };

  const pickUp = (d: DragState) => {
    try {
      navigator.vibrate?.(15);
    } catch {
      /* not supported */
    }
    update({ ...d, active: true });
  };

  const isBlocked = (t: Tile) => !onToggle || t.kind.type === "joker" || (!selected.has(t.id) && !canSelectMore);

  // Window-level listeners while a finger or mouse is down, so the drag never gets lost.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.startX;
      if (!d.active) {
        if (Math.abs(dx) < SLIDE_PX) return;
        window.clearTimeout(holdTimer.current);
      }
      e.preventDefault();
      const x = d.centers[d.from]! + dx;
      let over = 0;
      let best = Infinity;
      d.centers.forEach((c, i) => {
        if (Math.abs(c - x) < best) {
          best = Math.abs(c - x);
          over = i;
        }
      });
      if (!d.active) pickUp({ ...d, dx, over });
      else update({ ...d, dx, over });
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      window.clearTimeout(holdTimer.current);
      update(null);
      if (d.active) {
        swallowClick.current = true;
        window.setTimeout(() => (swallowClick.current = false), 0);
        if (d.over !== d.from) moveTo(d.id, d.over);
      }
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusTile = (id: number) =>
    requestAnimationFrame(() => rowRef.current?.querySelector<HTMLButtonElement>(`[data-id="${id}"]`)?.focus());

  const moving = drag?.active ? tiles.find((t) => t.id === drag.id) : undefined;

  // While a tile is picked up, its neighbors slide over to open a gap where it will land.
  const shiftFor = (i: number): number => {
    if (!drag?.active) return 0;
    const { from, over, slot } = drag;
    if (i === from) return 0;
    if (from < over && i > from && i <= over) return -slot;
    if (over < from && i >= over && i < from) return slot;
    return 0;
  };

  return (
    <section className={`rack${moving ? " is-arranging" : ""}`} aria-label="Your rack">
      <div className="rack-head">
        <p className="rack-label">Your rack</p>
        <button type="button" className="rack-sort" onClick={onSort}>
          Sort
        </button>
      </div>
      <div className="rack-tiles" ref={rowRef}>
        {tiles.map((t, i) => {
          const isSel = selected.has(t.id);
          const blocked = isBlocked(t);
          const lifted = drag?.active && drag.id === t.id;
          const style = lifted
            ? { transform: `translate(${drag.dx}px, -20px) scale(1.15)` }
            : shiftFor(i)
              ? { transform: `translateX(${shiftFor(i)}px)${isSel ? " translateY(-12px)" : ""}` }
              : undefined;
          return (
            <TileView
              key={t.id}
              kind={t.kind}
              selected={isSel}
              fresh={fresh.has(t.id)}
              hinted={hinted.has(t.id)}
              dragging={!!lifted}
              blocked={blocked}
              onClick={() => {
                if (swallowClick.current) return;
                if (!blocked && onToggle) onToggle(t.id);
              }}
              buttonProps={{
                "data-id": t.id,
                ...(style ? { style } : {}),
                onContextMenu: (e) => e.preventDefault(),
                onPointerDown: (e) => {
                  if (e.pointerType === "mouse" && e.button !== 0) return;
                  const kids = Array.from(rowRef.current?.children ?? []) as HTMLElement[];
                  const rects = kids.map((k) => k.getBoundingClientRect());
                  const centers = rects.map((r) => r.left + r.width / 2);
                  const slot = rects.length > 1 ? rects[1]!.left - rects[0]!.left : rects[0]?.width ?? 0;
                  const d: DragState = {
                    id: t.id,
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    dx: 0,
                    active: false,
                    from: i,
                    over: i,
                    centers,
                    slot,
                  };
                  update(d);
                  window.clearTimeout(holdTimer.current);
                  holdTimer.current = window.setTimeout(() => {
                    const cur = dragRef.current;
                    if (cur && cur.id === t.id && !cur.active) pickUp(cur);
                  }, HOLD_MS);
                },
                onKeyDown: (e) => {
                  if (!e.shiftKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                  e.preventDefault();
                  moveTo(t.id, i + (e.key === "ArrowLeft" ? -1 : 1));
                  focusTile(t.id);
                },
              }}
            />
          );
        })}
      </div>
      <p className="rack-status" aria-live="polite">
        {moving ? `Moving ${tileName(moving.kind)}. Slide, then let go to drop it.` : ""}
      </p>
    </section>
  );
}

function RackNote({ hasFresh }: { hasFresh: boolean }) {
  return (
    <p className="rack-note">
      {hasFresh && (
        <>
          <span className="new-dot inline" aria-hidden="true" /> New tiles have a pink dot and sit at the right end.{" "}
        </>
      )}
      Tap a tile to pick it for passing. Press and hold to pick it up, then slide to move it.
    </p>
  );
}

function useSelection(max: number) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < max) next.add(id);
      return next;
    });
  return { selected, toggle, clear: () => setSelected(new Set()) };
}

function useHintAndHands({ hand, need }: { hand: readonly Tile[]; need: number }) {
  const [hint, setHint] = useState(false);
  const [showHands, setShowHands] = useState(false);
  const hinted = useMemo(() => (hint && need > 0 ? new Set(choosePass(hand, CARD, need)) : new Set<number>()), [hint, hand, need]);
  return {
    hinted,
    controls: (
      <div className="helpers">
        <button type="button" className="ghost" onClick={() => setHint((h) => !h)} aria-pressed={hint} disabled={need === 0}>
          {hint ? "Hide hint" : "Ask for a hint"}
        </button>
        <button type="button" className="ghost" onClick={() => setShowHands((s) => !s)} aria-pressed={showHands}>
          {showHands ? "Hide closest hands" : "Show closest hands"}
        </button>
      </div>
    ),
    panel: showHands ? <ClosestHands hand={hand} /> : null,
  };
}

function PassScreen({ game, rack, onPass }: { game: Game; rack: Arrangement; onPass: (ids: number[], blind: number) => void }) {
  const step = currentStep(game);
  const [blind, setBlind] = useState(0);
  const need = 3 - blind;
  const { selected, toggle, clear } = useSelection(need);
  const hand = game.hands[ME];
  const { hinted, controls, panel } = useHintAndHands({ hand, need });
  if (step.kind !== "pass") return null;
  const to = SEAT_NAME[seatTo(ME, step.direction)];

  return (
    <main className="screen">
      <div className="step-card">
        <p className="eyebrow">{stepLabel(step)}</p>
        <h2>
          Pass {step.direction} <span className="muted">to {to}</span>
        </h2>
        <p>
          {need === 0
            ? `You're passing all 3 tiles you receive on to ${to} without looking.`
            : `Pick ${need} ${need === 1 ? "tile" : "tiles"} to pass. Jokers can't be passed.`}
        </p>
        {step.blind && (
          <fieldset className="blind">
            <legend>Blind pass: send on tiles you receive, unseen</legend>
            <div className="segmented">
              {[0, 1, 2, 3].map((n) => (
                <label key={n} className={blind === n ? "on" : ""}>
                  <input
                    type="radio"
                    name="blind"
                    value={n}
                    checked={blind === n}
                    onChange={() => {
                      setBlind(n);
                      clear();
                    }}
                  />
                  {n}
                </label>
              ))}
            </div>
          </fieldset>
        )}
      </div>

      <Rack arrangement={rack} selected={selected} hinted={hinted} fresh={game.fresh} onToggle={toggle} canSelectMore={selected.size < need} />
      <RackNote hasFresh={game.fresh.size > 0} />

      {controls}
      {panel}

      <div className="actions">
        <button type="button" className="primary" disabled={selected.size !== need} onClick={() => onPass([...selected], blind)}>
          {need === 0 ? "Pass blind" : `Pass ${selected.size} of ${need}`}
        </button>
      </div>
    </main>
  );
}

function VoteScreen({ game, rack, onVote }: { game: Game; rack: Arrangement; onVote: (yes: boolean) => void }) {
  return (
    <main className="screen">
      <div className="step-card">
        <p className="eyebrow">First Charleston done</p>
        <h2>Play the second Charleston?</h2>
        <p>Any player can stop it. The other players want to keep going, so it's your call.</p>
      </div>
      <Rack arrangement={rack} selected={new Set()} hinted={new Set()} fresh={game.fresh} canSelectMore={false} />
      <RackNote hasFresh={game.fresh.size > 0} />
      <div className="actions two">
        <button type="button" className="ghost" onClick={() => onVote(false)}>
          Stop here
        </button>
        <button type="button" className="primary" onClick={() => onVote(true)}>
          Keep going
        </button>
      </div>
    </main>
  );
}

function CourtesyScreen({ game, rack, onPass }: { game: Game; rack: Arrangement; onPass: (ids: number[]) => void }) {
  const { selected, toggle } = useSelection(3);
  const hand = game.hands[ME];
  const { hinted, controls, panel } = useHintAndHands({ hand, need: Math.min(3, WEST_OFFER) });
  return (
    <main className="screen">
      <div className="step-card">
        <p className="eyebrow">Last step</p>
        <h2>
          Courtesy pass <span className="muted">with West</span>
        </h2>
        <p>
          Offer 0 to 3 tiles. West offers {WEST_OFFER}, so you'll each pass the smaller number. Pick in the order you'd give them up.
        </p>
      </div>
      <Rack arrangement={rack} selected={selected} hinted={hinted} fresh={game.fresh} onToggle={toggle} canSelectMore={selected.size < 3} />
      <RackNote hasFresh={game.fresh.size > 0} />
      {controls}
      {panel}
      <div className="actions">
        <button type="button" className="primary" onClick={() => onPass([...selected])}>
          {selected.size === 0 ? "Pass nothing" : `Offer ${selected.size}`}
        </button>
      </div>
    </main>
  );
}

function MiniTiles({ tiles }: { tiles: readonly Tile[] }) {
  return (
    <span className="mini-row">
      {sortTiles(tiles).map((t) => (
        <TileView key={t.id} kind={t.kind} size="mini" />
      ))}
    </span>
  );
}

function ConcreteGroups({ row }: { row: HandDistance }) {
  const def = CARD.hands.find((h) => h.id === row.handId)!;
  const concrete = expandHand(def).find((c) => c.variant === row.variant)!;
  let n = 0;
  return (
    <span className="groups">
      {concrete.groups.map((g, i) => (
        <span className="group" key={i}>
          {g.tiles.map((code) => (
            <TileView key={n++} kind={kindFromCode(code)} size="mini" />
          ))}
        </span>
      ))}
    </span>
  );
}

function ClosestHands({ hand }: { hand: readonly Tile[] }) {
  const rows = useMemo(() => closestDistinct(hand, CARD, 3), [hand]);
  return (
    <section className="panel">
      <h3>Your closest hands</h3>
      <ul className="hands">
        {rows.map((r) => (
          <li key={r.handId}>
            <div className="hand-head">
              <strong>{handName(r.handId)}</strong>
              <span className="muted">{r.tilesAway} tiles away</span>
            </div>
            <ConcreteGroups row={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewEntry({ entry }: { entry: LogEntry }) {
  const [numbers, setNumbers] = useState(false);
  const r = entry.review;
  const suggested = r ? entry.handBefore.filter((t) => r.suggested.includes(t.id)) : [];
  const same = r ? r.suggested.every((id) => entry.passed.some((t) => t.id === id)) : true;
  return (
    <li className="review-entry">
      <div className="hand-head">
        <strong>{entry.label}</strong>
        {r ? <span className={`badge rating-${r.rating}`}>{RATING_LABEL[r.rating]}</span> : <span className="badge">Blind</span>}
      </div>
      <div className="review-row">
        <span className="muted">You passed</span>
        {entry.passed.length > 0 ? <MiniTiles tiles={entry.passed} /> : <span>nothing from your hand</span>}
        {entry.blind > 0 && <span className="muted">+ {entry.blind} blind</span>}
      </div>
      {r && !same && (
        <div className="review-row">
          <span className="muted">Suggested</span>
          <MiniTiles tiles={suggested} />
        </div>
      )}
      {entry.received.length > 0 && (
        <div className="review-row">
          <span className="muted">You got</span>
          <MiniTiles tiles={entry.received} />
        </div>
      )}
      {r && <p className="reason">{r.reason}</p>}
      {r && (
        <>
          <button type="button" className="link" onClick={() => setNumbers((v) => !v)} aria-expanded={numbers}>
            {numbers ? "Hide the numbers" : "Show me the numbers"}
          </button>
          {numbers && (
            <div className="numbers">
              <div>
                <p className="muted">After your pass</p>
                <ul>
                  {r.closestAfter.map((d) => (
                    <li key={d.handId}>
                      {handName(d.handId)}: {d.tilesAway} away
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="muted">After the suggested pass</p>
                <ul>
                  {r.closestAfterSuggested.map((d) => (
                    <li key={d.handId}>
                      {handName(d.handId)}: {d.tilesAway} away
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </li>
  );
}

function ReviewScreen({ game, rack, onReplay, onNew }: { game: Game; rack: Arrangement; onReplay: () => void; onNew: () => void }) {
  const counts = game.log.reduce<Record<string, number>>((acc, e) => {
    if (e.review) acc[e.review.rating] = (acc[e.review.rating] ?? 0) + 1;
    return acc;
  }, {});
  const summary = (["great", "fine", "missed", "costly"] as const)
    .filter((k) => counts[k])
    .map((k) => `${counts[k]} ${RATING_LABEL[k].toLowerCase()}`)
    .join(", ");
  return (
    <main className="screen">
      <div className="step-card">
        <p className="eyebrow">Charleston review</p>
        <h2>How your passes went</h2>
        <p>{summary ? `${summary}.` : "No passes to rate."} Ratings judge what you kept, since you can't see what's coming back.</p>
      </div>
      <ol className="review">
        {game.log.map((e, i) => (
          <ReviewEntry key={i} entry={e} />
        ))}
      </ol>
      <Rack arrangement={rack} selected={new Set()} hinted={new Set()} fresh={game.fresh} canSelectMore={false} />
      <ClosestHands hand={game.hands[ME]} />
      <div className="actions two">
        <button type="button" className="ghost" onClick={onReplay}>
          Replay this deal
        </button>
        <button type="button" className="primary" onClick={onNew}>
          New deal
        </button>
      </div>
    </main>
  );
}

// Mini tiles in "closest hands" come from tile codes, so turn a code back into a kind.
function kindFromCode(code: string) {
  if (code === "J") return { type: "joker" } as const;
  if (code === "F") return { type: "flower" } as const;
  if (code[0] === "W") return { type: "wind", wind: code[1] as "N" | "E" | "S" | "W" } as const;
  if (code[0] === "D" && "RGW".includes(code[1]!)) {
    return { type: "dragon", dragon: ({ R: "red", G: "green", W: "white" } as const)[code[1] as "R" | "G" | "W"] } as const;
  }
  const suit = ({ B: "bam", C: "crak", D: "dot" } as const)[code[0] as "B" | "C" | "D"];
  return { type: "suit", suit, rank: Number(code[1]) as 1 } as const;
}
