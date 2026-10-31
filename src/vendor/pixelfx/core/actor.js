import { hex } from "./color.js";
// A stock character to try effects on: status effects wrap its silhouette, hits land on it, auras sit
// behind it. Previews and the gallery draw it; effects only read its mask through o.actor.

const HERO = [
  "....kkkkk...",
  "..kkhhhhhk..",
  ".khhhhhhhhk.",
  ".khhhhhhhhhk",
  ".khhssssshhk",
  ".khsessesshk",
  ".khsessesshk",
  "..ksssssssk.",
  "...kkSSSkk..",
  "..kttttttk..",
  ".kttTttTttk.",
  ".ksttTTttsk.",
  ".kstttttttk.",
  "..kbbbbbbk..",
  "..kppkkppk..",
  "..kppk.kppk.",
  "..kppk.kppk.",
  "..koook.kook",
  "..kkkkk.kkkk",
];
const HERO_PAL = {
  k: "#17121f", h: "#7a4128", s: "#f3c49d", S: "#c98b6c", e: "#17121f",
  t: "#5f6f94", T: "#46536f", b: "#8a5a32", p: "#38334a", o: "#6a4030",
  // the 2x character's extra detail
  H: "#a35d34", w: "#ffffff", m: "#a3564a", g: "#e8c060", L: "#7f90b6", O: "#8f5a3f",
};
// The same character at twice the size (24 x 38): Scale2x of HERO, outline thinned back to 1 px, detail added.
const HERO2 = [
  ".........kkkkkkkk.......",
  ".......kkhhhhhhhhkk.....",
  ".....kkhhhHHhhhhhhk.....",
  "...kkhhHHHhhhhhhhhhkk...",
  "...khhHHhhhhhhhhhhhhk...",
  "..khhHHhhhhhhhhhhhhhhkk.",
  "..khhhhhhhhhhhhhhhhhhhk.",
  "..khhhhhhhhhhhhhhhhhhhhk",
  "..khhhhSSssssssSShhhhhhk",
  "..khhhhsssssssssssshhhhk",
  "..khhhhswessssewssshhhhk",
  "..khhhsseesssseesssshhhk",
  "..khhhsseesssseesssshhhk",
  "...khhsseesssseesssshhk.",
  "...kkhsssssmmssssssshkk.",
  ".....kssssssssssssssk...",
  "......ksssSSSSSSssskk...",
  "......kttSSSSSSSSkkk....",
  ".....ktttttttttttttk....",
  "...kktLLttttttttttttk...",
  "...ktLLtTTttttTTttttk...",
  "..kttLttTTTttTTTtttttk..",
  "..kssttttTTTTTTtttsssk..",
  "..ksssttttTTTTttttsssk..",
  "..kssstttttttttttttttk..",
  "...kssttttttttttttttk...",
  "...kksbbbbbggbbbbbtkk...",
  "....kbbbbbbggbbbbbbk....",
  "....kpppppbbbbpppppk....",
  "....kppppppkkkppppppk...",
  "....kppppppk..kpppppk...",
  "....kppppppk..kppppppk..",
  "....kppppppk..kppppppk..",
  "....kppppppk...kpppppok.",
  "....koOOooook...kpOOook.",
  "....kkoooooook..kkoooook",
  "....kkkoooookk..kkkoookk",
  ".....kkkkkkkk....kkkkkk.",
];


function maskOf(rows, k = 1) {
  const h = rows.length * k, w = rows[0].length * k, data = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    if (ch === ".") return;
    for (let j = 0; j < k * k; j++) data[(y * k + ((j / k) | 0)) * w + x * k + (j % k)] = 1;
  }));
  return { w, h, data };
}

const MASKS = { 1: maskOf(HERO, 1), 2: maskOf(HERO2, 1) };
const SPRITES = { 1: HERO, 2: HERO2 };
// the character's own colors, row by row (0 where empty), for effects that recolor it: frozen, poisoned, stone
function pixelsOf(rows) {
  const w = rows[0].length, data = new Uint32Array(w * rows.length);
  rows.forEach((r, y) => [...r].forEach((ch, x) => (data[y * w + x] = ch === "." ? 0 : hex(HERO_PAL[ch]))));
  return data;
}
const PIXELS = { 1: pixelsOf(HERO), 2: pixelsOf(HERO2) };

/**
 * The stock actor at scale k (1: 12 x 19 px, 2: 24 x 38 px), in local space with its feet at (0, 0):
 * { mask, x, y (top-left of the mask), w, h, k, head: [x, y] (top of the head), chest: [x, y] }.
 */
export function stockActor(k = 1) {
  k = k === 2 ? 2 : 1;
  const m = MASKS[k], x = -Math.floor(m.w / 2), y = -m.h;
  return { mask: m, pixels: PIXELS[k], x, y, w: m.w, h: m.h, k, head: [0, y], chest: [0, y + 11 * k] };
}

/** Draw the stock actor with its feet at the painter's origin, at alpha a (dithered). */
export function drawActor(p, actor = stockActor(), a = 1) {
  if (a > 0) p.sprite(SPRITES[actor.k === 2 ? 2 : 1], HERO_PAL, actor.x, actor.y, { a });
}
/** How visible an effect wants the stand-in character at time t (effects may export actorAlpha). */
export const actorAlphaOf = (mod, t, o) => (typeof mod.actorAlpha === "function" ? mod.actorAlpha(t, o) : 1);

export { HERO, HERO2, HERO_PAL };
