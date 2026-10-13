# sky_steam 칩셋 (하늘섬 A + 증기 산업도시 B)

> 상태: 설계 중, 번들 배선 없음. 근거 계약: AGENTS.md 3/4 관문(object-gate), tiledata/AI-REFERENCE-CONTRACT.md.

## 공용 모듈 (`scripts/content/sky-steam/`)
- `palette.py` — `K(name, t)` 9단 램프. 월드맵 steampunk 재질(brass soot magi copper iron) + 새색 sky cloud + 섬(grass rock earth wood canvas red). 이름은 추가만.
- `registry.py` — `Cv`(캔버스) · `@piece(id,name,w,h,kind,line,solid,frames)` · `run_cli('A'|'B')`: `export` → `tiledata/sky-steam/pieces/<line>/_gate/*.png` + `/tmp/sky-<line>-batch.jsonl`, `status` = 영수증만 읽기(모델 호출 없음).
- 파일 소유: A = `sky_a_*.py`, B = `steam_b_*.py`.
- 관문: `npm run harness -- object-gate review --batch /tmp/sky-A-batch.jsonl 2>&1 | grep -E "^(PASS|FAIL)"` (판정자 gemini-3.8-flash x4, rail-kits 의 rules.ts 변경과 같다).

## 줄 A — 하늘섬
(진행 후 채움)
