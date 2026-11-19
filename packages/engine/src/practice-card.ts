// An original practice card. It's laid out like a real card so the app is fully
// playable and shareable, but every hand on it was written for this project.
// It is not the NMJL card. Your own copy of that goes in cards/private/ and is never committed.

import type { Card } from "./card.js";

export const PRACTICE_CARD: Card = {
  name: "Mahjong Coach practice card",
  hands: [
    { id: "year-1", section: "2026", text: "FF 2026a 2026b 2026c", value: 30, concealed: false },
    { id: "year-2", section: "2026", text: "222a 0000 2222b 666b", value: 25, concealed: false },

    { id: "even-1", section: "Evens", text: "FF 22a 444b 666b 8888c", value: 25, concealed: false },
    { id: "even-2", section: "Evens", text: "2222a 44a 6666b 88b DDa", value: 30, concealed: false },

    { id: "odd-1", section: "Odds", text: "FF 11a 333a 555a 7777a", value: 25, concealed: false },
    { id: "odd-2", section: "Odds", text: "1111a 33b 55b 7777c 99c", value: 30, concealed: false },

    { id: "run-1", section: "Runs", text: "xxxxa yyyya zzza FFF", value: 25, concealed: false },
    { id: "run-2", section: "Runs", text: "FF xxa yyyb zzzzc DDDa", value: 30, concealed: false },

    { id: "like-1", section: "Like numbers", text: "FFF xxxxa xxxxb xxxc", value: 25, concealed: false },
    { id: "like-2", section: "Like numbers", text: "xxxa xxxb xxxxc DDDDa", value: 30, concealed: false },

    { id: "wind-1", section: "Winds and dragons", text: "NNNN EEE WWW SSSS", value: 25, concealed: false },
    { id: "wind-2", section: "Winds and dragons", text: "NN EEEE WWWW SS DDa", value: 30, concealed: false },
    { id: "wind-3", section: "Winds and dragons", text: "FFFF DDDa DDDb DDDDc", value: 30, concealed: false },

    { id: "quint-1", section: "Quints", text: "xxxxxa yyyyb FFFFF", value: 40, concealed: false },

    { id: "pairs-1", section: "Singles and pairs", text: "11a 22a 33a 44b 55b 66b 77c", value: 50, concealed: true },
  ],
};
