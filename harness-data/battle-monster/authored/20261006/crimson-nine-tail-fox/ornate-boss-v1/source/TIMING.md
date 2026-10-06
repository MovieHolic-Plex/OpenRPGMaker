# Preview timing and anchors

All coordinates refer to the original 96 × 96 source cell, top-left origin. `progress/*.gif` are native96 fixed-palette previews; `*-4x.gif` are diagnostic nearest enlargements. GIFs loop, including the collapse preview. These are proposed visual holds, not verified game hit synchronization.

| GIF | Source order | Holds in milliseconds |
|---|---|---|
| idle | idle_a → idle_b → idle_c → idle_b | 230 / 230 / 230 / 230 |
| attack | idle_a → windup → move → attack → recover → idle_a | 230 / 200 / 100 / 150 / 180 / 230 |
| hit | idle_a → hit → recover → idle_a | 350 / 180 / 230 / 350 |
| dead | idle_a → hit → dead | 350 / 180 / 1600 |
| skill | idle_a → skill_a → skill_b → skill_c → recover → idle_a | 230 / 280 / 180 / 240 / 180 / 230 |
| poison | poison_a → poison_b | 400 / 400 |
| stun | stun_a → stun_b | 330 / 330 |
| sleep | sleep_a → sleep_b | 550 / 550 |

## Physical sequence

Windup lowers muzzle and shoulders, gathers tails and folds the near elbows. Move stretches the torso and extends the hind pushing leg. Attack opens the jaw and advances both forepaws; intended visual contact is the right-facing fang/jaw area around **(77, 55)** and the reaching near paw around **(81, 83)**. Recover closes the jaw and re-centers weight on bent forelegs. These points describe the drawing; no engine collision or damage event was authored here.

## 홍련구화

- **skill_a**: mouth/core around **(74, 48)**. Three upper tail terminals light separately. The bent paws brace the shoulder.
- **skill_b**: source mouth connection around **(74, 50)**, with a curved flame rising toward **(91, 26)** and a second tongue dropping toward **(86, 69)**. Bright cream/yellow core stays attached to the mouth-facing trunk. Body and collar remain readable behind the effect.
- **skill_c**: closed recovering lip around **(74, 48)**; detached remnants around **(88, 44)** and **(90, 63)**. Tail flames cool and the foreknee releases.

Poison bubbles and stun stars are small authored status ornaments. Sleep changes the flank locally while keeping the shut eye and tucked paw connections. None of these previews supplies gameplay state or hit synchronization.
