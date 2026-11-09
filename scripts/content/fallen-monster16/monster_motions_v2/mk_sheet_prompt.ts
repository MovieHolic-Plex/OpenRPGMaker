// usage: bun mk_sheet_prompt.ts <key> <description> <cast-flavour> <guard-flavour> [flying]
const [k, desc, cast, guard, flying] = process.argv.slice(2);
const fly = flying === 'flying';
const ground = fly ? 'hovering at the same height above an invisible ground line in each cell' : 'feet on the same ground line inside each cell';
const t = `Attached is the approved sprite of this monster: pixel art upscaled with nearest-neighbour, on a magenta background.
The monster: ${desc}
Draw ONE sprite sheet image of THE SAME MONSTER for a side-view turn-based RPG battle (16-bit JRPG): a 4 by 4 grid of 16 equal square cells, with wide empty magenta gaps between cells so no pose touches another. Every pose is drawn with exactly the same markings, same colours, same proportions and same pixel size as the attached sprite, facing RIGHT, ${ground}, crisp hard edges, no anti-aliasing, no blood. Cells in reading order (left to right, top to bottom):
1 idle: the same pose as the attached sprite.
2 idle breathing: same as 1, body one pixel higher and slightly expanded.
3 idle sway: same as 1 with a small secondary motion (${fly ? 'wings/tentacles shifted' : 'head and tail shifted'}).
4 wind-up: coiled back, gathering strength before attacking, weight pulled backward.
5 move: ${fly ? 'swooping forward fast, body tilted forward' : 'charging forward in a big stride'}.
6 attack: the strike at full extension towards the right, the most aggressive frame.
7 recover: pulling back after the attack, off balance, returning to stance.
8 hit: struck hard: body squashed and bent backwards, head snapped back, eyes shut, recoiling to the left. The recoil must read clearly by the shape alone.
9 defeated: collapsed lying on the ground, eyes closed.
10 attack follow-through: halfway between wind-up and strike, lunging.
11 ${cast} (charging): gathering a glowing power, small glow, body tense.
12 ${cast} (release): unleashing the power to the right, a burst of energy.
13 guard: ${guard}, braced and defensive.
14 weakened: exhausted and wounded, drooping, sagging low, barely staying up.
15 battle cry intro: rearing up tall and threatening, roaring, showing off its full size.
16 leave this cell completely empty.
Square image. Flat solid magenta (#FF00FF) background everywhere. No grid lines, no numbers, no text, no shadow, no scenery, no watermark.`;
await Bun.write('/home/main/claude-viz/monster-motions-v2/jobs/' + k + '-sheet.txt', t);
console.log(t.length);
