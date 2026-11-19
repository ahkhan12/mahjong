# Mahjong Coach

An American mahjong app for getting better: you play every decision yourself, then the app shows you what a stronger choice would have been and why.

## Structure

- `packages/engine`: the rules engine in plain TypeScript, with no UI code. Tiles, the deal, the Charleston, and (coming next) the card notation, calling, jokers and scoring.
- `packages/coach` (coming): simulation and coaching, run in a background worker.
- `apps/web`: the phone-friendly web app. Right now it's the Charleston trainer.

## Getting started

```sh
pnpm install
pnpm test                          # engine tests
pnpm --filter @mahjong-coach/web dev   # run the app at http://localhost:5173
```

Add `?deal=1234` to the URL to replay a specific deal.

## The NMJL card

The official card isn't included and must never be committed. Put your own copy in `cards/private/`, which git ignores. The app ships with an original practice card instead.
