# 캐릭터 칩 하네스 — Actor1 뼈대에 AI 가 직접 도트를 찍는다

RPG Maker 2000 CharSet 캐릭터 한 명(72×128 = 24×32 프레임 3장 × 방향 4개)을 만든다.
**생성 이미지는 쓰지 않는다.** 작업자 모델이 격자 글자(`.chr.txt`, 한 글자 = 한 픽셀)를 직접 고치고, 하네스가 PNG·GIF 로 굽는다.
뼈대는 `public/assets/easyrpg/charset/Actor1.png` 의 한 명 — 몸 비율·걸음 동작은 그대로 두고 머리 모양·옷·색·소지품을 바꾼다.
**고르는 건 사용자다.** 감독(세션 에이전트)은 후보를 나란히 보여 줄 뿐, 대신 판정해 번들·맵에 넣지 않는다.

## 흐름
```
brief(harness-data/charset-actor/briefs.json) ── 뼈대 번호 + 만들 캐릭터 + 지킬 것
   │
draw ── 작업자(엔진별 1명, 같은 지시) — Claude Sonnet 5.5 medium · Opus 5.5 high(`claude -p`) · GPT 6.1 sol medium(`codex exec`)
   │    수정 작업: `--src` 로 다른 작업자 결과에서 시작, `--fix-notes` 의 감독 지적을 고친다
   │    작업자는 check(기계 검수) · views(8배 시트·필름 띠) 를 스스로 돌리며 고친다
   ▼
page ── 엔진별 결과를 뼈대 원본과 나란히: 걷기 GIF·돌기 GIF·칸 위를 걷는 GIF·1배·8배·필름 띠·기계 검수
   │    → http://mdc-server:18301/charset-actor-<실행>.html
사용자 판정
```

## 기계 검수 (`chr.gate`) — 형식을 거르는 것이지 품질 판정이 아니다
기준은 Actor1 8명에서 쟀고 `calibrate` 가 8명 전원 통과를 확인한다.
색 ≤32 · 배경 키 색 금지 · 실루엣 190~420px · 칸 가장자리까지 차지 않음 · 윤곽 픽셀 중 어두운 것 ≥75% ·
걸음 프레임 사이 머리 높이 출렁임 ≤1px(Actor1 은 정확히 1px) · 걸음 0·2 의 다리가 실제로 다름 · 걸음 0↔2 에서 바뀐 픽셀 ≥70(Actor1 최소 79)이고 뼈대의 ≥60% · 걸음 프레임 ≠ 서 있는 자세 ·
뼈대와 다른 픽셀 ≥20%(복사 방지). 경고: 한 프레임에만 나오는 색(깜빡임), 실루엣이 원본과 같음(색만 바꿈), 발끝 줄 어긋남.

## GIF 는 사람용, 필름 띠는 모델용
모델 이미지 입력은 대개 GIF 의 첫 장만 본다. 그래서 AI 쪽 검수(작업자 자기 검수·이후 붙일 독립 검수자)는
`strip.png`(방향마다 원본 | 0 | 1 | 2 | 1 | 0↔2 차이 빨강)와 `sheet_x8.png`(4px 격자선)로 하고, GIF 는 사용자 화면에만 쓴다.

## 명령
```bash
H=src/harnesses/charset-actor/harness.py
python3 $H calibrate                                 # 기계 검수가 Actor1 8명을 통과시키는지
python3 $H draw hunter --engine sonnet --run R       # 백그라운드 작업자(최대 60분, CHR_HARNESS_TIMEOUT)
python3 $H draw hunter --engine gpt --run R
python3 $H status --run R
python3 $H page --run R                              # 비교 화면
python3 $H check F.chr.txt --base 0 / views F.chr.txt OUT --base 0
```

## 파일
| 파일 | 하는 일 |
|---|---|
| `harness.py` | 명령들, 작업자 실행(`claude -p` / `codex exec`), 비교 화면 |
| `chr.py` | `.chr.txt` 읽기·쓰기, Actor1 → 격자, 기계 검수, 시트·필름 띠·GIF 3종 |
| `worker.md` | 작업자 지시문 틀(절대 규칙: 생성 이미지·외부 그림 금지, 모양은 격자를 직접 고쳐서) |
| `fixer.md` | 수정 작업 덧붙임 — `draw --src <다른 작업 폴더> --fix-notes <감독 지적>` 이면 그 결과에서 시작해 지적을 고친다 |
| `harness-data/charset-actor/briefs.json` | 만들 캐릭터 목록 |
| `harness-data/charset-actor/lawn16.png` | GIF 바닥 잔디(정글 칩셋 잔디 칸) |

실행 산출물은 저장소 밖 `~/.local/share/oprn/charset-actor-harness/runs/<실행>/<brief>__<엔진>/`
(`prompt.md`·`worker.log`·`out.chr.txt`·`notes.md`·`views/`·`base-views/`).

## 아직 없는 것
- 독립 검수자(그린 모델이 아닌 모델이 필름 띠를 보고 PASS/FAIL·고칠 점) — 첫 비교를 사용자가 본 뒤 붙인다.
- 받기/버리기 화면과 결정 파일, 받은 캐릭터를 번들 CharSet 에 넣는 단계.
- 하네스 레지스트리(`src/harnesses/_core`, PR #1832) 등록.
