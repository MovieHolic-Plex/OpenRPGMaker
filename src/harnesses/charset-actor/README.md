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

## 고치기 루프 (`loop`) — GPT 가 고치고 Sonnet 이 검수한다 (2026-10-02 사용자 지시)
```
r1: drawer(기본 gpt) 가 뼈대에서 그린다 → reviewer(기본 sonnet medium) 가 판정 → verdict.json
r2..: 불합격이면 직전 판의 out.chr.txt 에서 시작해 검수자 지적(issues·good)을 고친다 → 다시 판정
멈춤: 검수 PASS(high·mid 지적 0, 점수 ≥8) 또는 --rounds(기본 1)
```
**기본은 원샷(1판)이다.** 2026-10-02 남·여 4판 실험(기사 5→6점, 약초사 4→5점, 8판 전부 FAIL) 뒤 사용자 판단:
「원샷에 바꿔놓는 게 제일 낫다」. 고치기 판은 같은 지적을 국소 수정으로 반복할 뿐 핵심 형태를 못 바꿨다.
검수자는 그대로 돌려 판정·지적을 화면에 붙인다(사용자 판단 자료). 반복이 필요하면 `--rounds N` 을 명시한다.
검수자는 작업자의 notes.md 를 받지 않는다(그림·기계 검수·지시만). 기계 검수가 막으면 검수자 판정과 상관없이 FAIL.
검수자 지시문 `reviewer.md`, 검수자가 보는 그림 `strip.png`·`base_strip.png`·`sheet_x8.png`·`context.png`(Actor1 네 명 옆에 세움).

## 얼굴 (48×48 FaceSet) — `faces --run R` 또는 `loop` 끝에 자동(`--face sonnet`)
뼈대는 같은 번호의 Actor1 얼굴(`public/assets/easyrpg/faceset/Actor1.png`, 칩 n번 ↔ 얼굴 n번 — `sharedCharacterGraphics.json`).
원본은 125색이라 64색으로 줄여 꺼낸다(`chr.from_faceset`, 눈으로는 차이 없음). 작업자는 완성 칩을 보고 머리·색·장신구만 고친다(`face.md`).
결과 `<작업 폴더>/face/out.face.txt`·`face/views/{face,face_x4,compare}.png`. 기계 검수: 48×48, 색 ≤90, 뼈대 얼굴과 ≥15% 다름.
흉상·전신은 아직 없다 — 공용 흉상·전신(`public/assets/shared/portraits/`)은 1000px 생성 그림이라 뼈대로 쓸 수 없다(생성 이미지 금지).

**얼굴은 생성으로 (2026-10-02 사용자 결정 — 칩은 계속 손 도트, 얼굴만 예외)** `gen-faces --run R [--redo]`:
- v1(폐기): [Actor1 원본 얼굴 | 새 칩]을 주고 「이 캐릭터로 다시 그려라」 → 사용자 「얼굴이 너무 많이 바뀐다, 각도까지 꽉 하네싱」.
  18명 모두 각도·구도·얼굴 크기가 바뀌었다(각도 점수 -0.01~0.47).
- v2: 손 도트 얼굴(`faces` 결과 — 원본과 픽셀 골격이 같고 머리·색만 바뀐 것)을 정사각 그대로 참고로 주고
  「손질만, 각도·눈코입 위치·구도·배경은 잠금」(`gen_face.PROMPT_LOCK`). 그래서 **손 도트 얼굴이 먼저** 있어야 한다.
- 각도 점수 `gen_face.pose_score`: 손 도트가 원본에서 손대지 않은 칸(= 얼굴 골격, `kept_mask`)에서 생성 결과와 원본의 밝기 구조 상관.
  `POSE_MIN`(0.65) 이상이 나올 때까지 최대 3번 다시 뽑고 가장 높은 것을 쓴다. 점수·시도는 `face_gen/meta.json`, 화면에도 표시.
  → 각도는 지켰지만 손 도트를 다듬는 데 그쳤다. 사용자 「많이 바꿔도 괜찮다, 보는 각도만 유지한다면」.
- **v3(지금, `PROMPT_FREE`)**: 같은 참고 그림(손 도트 얼굴 한 장)에 생김새·머리·표정·피부·옷은 자유, 고개 방향·회전량·기울기·시선·구도만 잠금.
  판정은 **각도 전용 검수자** `gen_face.judge_angle`(Sonnet 5.5 medium, 원본 얼굴과 후보 두 장만 보고 JSON) — 같은 방향이고 `ANGLE_MIN`(7/10) 이상일 때까지
  최대 3번. 골격 점수(v2)는 참고로만 `tried[].pose` 에 남긴다. 이전 판은 `face_gen_<판>/` 으로 옮겨 둔다.
  참고 그림에 칩을 나란히 넣으면(v1) 다시 그려서 각도가 무너진다 — 참고 그림은 얼굴 한 장만.
- API 는 흉상·전신 파이프라인과 같은 `MDC_IMAGE_API`(god-tibo-imagen, 참고 그림 한 장·마스크 없음). 1024 → 48×48 LANCZOS + 96색.
- 화면은 생성 얼굴을 크게, 손 도트 얼굴을 작게 함께 보여 준다. `face_gen/compare.png` = [원본 | 손 도트 | 생성 | 칩].

## 받기/버리기 화면 (`serve`, 18314)
http://mdc-server:18314/ — 비포(Actor1 원본 걷기·돌기·시트·얼굴)와 애프터를 위아래로 나란히. 모든 실행의 완성본을 걷기·돌기·칸 위 걷기 GIF, Actor1 옆에 세운 그림, 검수자 판정(참고용)과 함께 보여 준다.
`A` 받기 · `R` 버리기(이유 칩 + 메모, `Enter`) · `↑↓` 이동. 결정의 정본은 `~/.local/share/oprn/charset-actor-harness/decisions.jsonl`(추가만),
결정마다 `harness-data/charset-actor/decisions.json` 사본과 `accepted/<폴더>__<실행>.chr.txt`·`.png`(받은 것만)를 다시 쓴다.
서버는 사용자 유닛(transient) — 죽었으면:
```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus
systemd-run --user --unit=charset-actor-harness -p Restart=on-failure /usr/bin/python3 <체크아웃>/src/harnesses/charset-actor/harness.py serve --port 18314
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
python3 $H loop knight-boy herbalist-girl --run R   # 원샷 그리기 + 검수(캐릭터마다 병렬). 반복은 --rounds N
python3 $H page --run R                              # 비교 화면
python3 $H check F.chr.txt --base 0 / views F.chr.txt OUT --base 0
```

## 파일
| 파일 | 하는 일 |
|---|---|
| `harness.py` | 명령들, 작업자 실행(`claude -p` / `codex exec`), 비교 화면, 받기/버리기 서버 |
| `web/index.html` | 받기/버리기 화면 |
| `reviewer.md` | 검수자 지시문 틀 |
| `face.md` | 얼굴 작업자 지시문 틀(손 도트) |
| `gen_face.py` | 생성 얼굴 — 참고 그림·프롬프트·48×48 축소 |
| `chr.py` | `.chr.txt` 읽기·쓰기, Actor1 → 격자, 기계 검수, 시트·필름 띠·GIF 3종 |
| `worker.md` | 작업자 지시문 틀(절대 규칙: 생성 이미지·외부 그림 금지, 모양은 격자를 직접 고쳐서) |
| `fixer.md` | 수정 작업 덧붙임 — `draw --src <다른 작업 폴더> --fix-notes <감독 지적>` 이면 그 결과에서 시작해 지적을 고친다 |
| `harness-data/charset-actor/briefs.json` | 만들 캐릭터 목록 |
| `harness-data/charset-actor/lawn16.png` | GIF 바닥 잔디(정글 칩셋 잔디 칸) |

실행 산출물은 저장소 밖 `~/.local/share/oprn/charset-actor-harness/runs/<실행>/<brief>__<엔진>/`
(`prompt.md`·`worker.log`·`out.chr.txt`·`notes.md`·`views/`·`base-views/`).

## 아직 없는 것
- 받은 캐릭터를 번들 CharSet(288×256, 8명)으로 묶어 `src/assets/bundled.ts` 에 넣는 단계.
- 하네스 레지스트리(`src/harnesses/_core`, PR #1832) 등록.
