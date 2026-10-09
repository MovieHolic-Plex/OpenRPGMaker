# Third Party Notices

OPRN Studio's own code and art are covered by `LICENSE.md`, `LICENSE-RUNTIME.md` and `ASSET-LICENSE.md`.
The components below belong to their authors and stay under their own licenses. Full texts are in `licenses/`
unless a link is given. Third party art and audio are listed separately in `public/assets/ATTRIBUTION.md`.

> 한국어 요약: 아래 구성 요소는 OPRN 것이 아니며 각자의 라이선스를 따른다. 전문은 `licenses/` 폴더,
> 제3자 그림·소리 크레딧은 `public/assets/ATTRIBUTION.md`.

## Shipped in exported games

| Component | Where | License |
|---|---|---|
| Phaser 3 — Richard Davey, Phaser Studio Inc. | `node_modules/phaser`, copied into exported games as `phaser.min-*.js` | MIT — `licenses/MIT-Phaser.md` (also prepended to the shipped file) |

## Shipped with the editor or its sites

| Component | Where | License |
|---|---|---|
| sql.js — sql.js contributors (SQLite is public domain) | `public/vendor/sql-wasm.wasm` | MIT — `licenses/MIT-sql.js.txt` |
| Galmuri 9 / Galmuri 11 — Lee Minseo | external community/store service artifacts, `tiledata/atlas-pick/bakeoff/**/Galmuri11.ttf` | SIL Open Font License 1.1 — `licenses/OFL-Galmuri.md` |
| Neo둥근모 (NeoDunggeunmo) — Eunbin Jeong | external community player artifact | `licenses/NeoDunggeunmo.txt` (reserved font names apply) |
| node-unrar-js — Jianrong Yu, compiling RARLAB's UnRAR source | npm dependency used by the desktop app to open `.rar` packs | MIT for the wrapper; the UnRAR source is under the UnRAR license, which allows use and redistribution but forbids using it to re-create the RAR compression algorithm. https://www.rarlab.com/license.htm |
| pngjs — pngjs contributors | bundled in `harness/**/lib/native.cjs` | MIT — https://github.com/pngjs/pngjs/blob/main/LICENSE |
| Unicode Character Database data | `src/project/unicode15Data.json` | Unicode License v3 — https://www.unicode.org/license.txt |

## Format compatibility

| Component | Where | Note |
|---|---|---|
| RPG Maker MV/MZ autotile composition tables | `src/project/rpgmakerMv/autotile.ts` | Small lookup tables matching `rpg_core.js` (MIT). Used only to read RPG Maker formats. "RPG MAKER" is a trademark of Gotcha Gotcha Games Inc.; see `TRADEMARKS.md`. |

npm dependencies installed by `npm install` keep their own license files under `node_modules/`; none is copyleft
(checked against `package-lock.json` on 2026-10-08).
