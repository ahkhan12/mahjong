# Mahjong Coach

An American mahjong app for getting better: you play every decision yourself, then the app shows you what a stronger choice would have been and why.

## Structure

- `packages/engine`: the rules engine in plain TypeScript, with no UI code. Tiles, the deal, the Charleston, and (coming next) the card notation, calling, jokers and scoring.
- `packages/coach` (coming): simulation and coaching, run in a background worker.
- `apps/web` (coming): the installable phone-friendly web app.

## Getting started

```sh
pnpm install
pnpm test
```

## The NMJL card

The official card isn't included and must never be committed. Put your own copy in `cards/private/`, which git ignores. The app ships with an original practice card instead.
