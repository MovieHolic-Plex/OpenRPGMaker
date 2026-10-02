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
  생성은 줌아웃돼 머리가 작게 나오기 쉽다(첫 v3 18명 중 9명이 「머리가 작다·어깨가 보인다」로 6점 이하) → `gen_face.align_crop` 이
  원본과 골격 상관이 가장 높은 확대(1.0~1.6)·위치(±18%)를 찾아 48×48 로 자른다. 그 뒤 18명 전원 7~8점(새로 뽑은 것 8장).
  `gen-faces --reuse` = 이미 뽑은 raw 를 다시 자르고 다시 판정, 모자라면 새로 뽑기.
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

## 지시문 쓰는 법 — 실루엣은 뼈대 그대로 (2026-10-02 사용자: 「무기나 모자 추가는 별로」)
판정 34개를 실루엣 변화량과 맞춰 보면 받은 11개 중앙값 47px, 버린 23개 중 19개가 140px 초과(무기·모자·날개·지팡이를 더한 것).
그래서 지시문은 **같은 실루엣의 다른 사람** — 머리색·옷 색 구성·안쪽 무늬·피부 톤만 바꾼다. 소지품·모자·두건·날개를 더하라고 쓰지 않는다.
`worker.md` 규칙 6, 기계 검수(뼈대 실루엣 밖 돌출 — 아래 「걸음 전파」 절), 생성 얼굴도 모자·장신구 추가 금지(`PROMPT_FREE`). 예: briefs 의 `c-*`.

## 걸음 전파 — 작업자는 서 있는 자세 4장만 고친다 (2026-10-02 「너무 비슷하다, 약간 더 바꾸되 걷는 게 어색하지 않아야」)
색만 바꾼 판(c-*)은 실루엣 0px 로 「너무 비슷하다」. 더 바꾸면 손으로 그린 걸음이 어긋난다 → `chr.propagate`:
뼈대 걸음 프레임 픽셀마다 서 있는 자세의 출발 자리를 3×3 무늬 대조(±3px, 출렁임 우선)로 찾아 새 서 있는 자세의 픽셀을 옮긴다.
같은 색이 근처에 없는 픽셀(걸음에만 있는 그림자)은 뼈대 색→새 색 대응표로, 뼈대에 없던 새 픽셀(머리 볼륨)은 출렁임만큼 내려 옮긴다.
원본 72명을 자기 자신으로 전파하면 걸음 프레임이 100% 그대로 나온다. 원본 걸음은 576장 중 572장이 「서 있는 자세 1px 아래」이고,
같은 자리 그대로인 비율은 머리 82%·몸통 25%·다리 12% — 몸통·다리는 대응 찾기가 필요하다.
`loop` 는 작업자가 끝나면 전파를 돌린다(작업자 원본 `out.worker.chr.txt`, `--no-propagate` 로 끔). 손으로 `propagate F --base K`.
소지품 검사도 바꿨다: 실루엣 변화 총량 대신 **뼈대 실루엣+2px 밖으로 튀어나온 픽셀**(프레임당 ≤10·합 ≤60). 판정 55개에서 받은 21개는
프레임당 ≤9, 소지품을 더해 버린 것은 11~42. 머리 모양·옷깃은 바꿀 수 있다. 지시 예: briefs 의 `v-*`.

## 뼈대 칩셋 — Actor1~4 · People1~5 (2026-10-02 「actor1 말고 다른 것들도」)
지시문 `base` 는 `"People3:7"` 처럼 칩셋:번호(0부터, 옛 정수는 Actor1). 짝 얼굴은 정본 `src/assets/sharedCharacterGraphics.json` 에서
RTP 얼굴(`easyrpg-faceset-*`)이 짝인 경우만 쓴다 — 72명 중 59명. 짝 얼굴이 생성 그림(`generated-faceset-*`)인 13명은 얼굴 단계를 건너뛴다.
`loop` 는 칩 → 검수 → 손 도트 얼굴 → 생성 얼굴(v3)까지 한 번에 간다(`--no-gen-face` 로 끔).

## 그림 넣어 고치기 + 수정 강도 (2026-10-03 「이런 거 약간 수정해서 쓰는 방향도… 약함·보통·강함」)
화면 왼쪽 위 「그림 넣어 고치기…」 또는 `ingest IMG --strength weak,normal,strong --go`. CharSet(72×128 한 명 / 288×256 여덟 명)을 받아
배경(왼쪽 위 픽셀 색, 투명이면 KEY)을 맞추고 `~/.local/share/oprn/charset-actor-harness/inputs/<id>.png` 로 둔다. 뼈대 키는 `input:<id>:<칸>`.
캐릭터가 있는 칸(1000px 이상)마다 × 고른 강도마다 지시가 하나씩 생긴다(`briefs-local.json`, 저장소 밖 — 남의 그림일 수 있다).
지시문은 비워도 된다 — 작업자가 강도 안에서 어떤 사람인지 정한다. 올린 그림은 짝 얼굴이 없어 얼굴 단계를 건너뛴다.
받은 것도 저장소가 아니라 `~/.local/share/oprn/charset-actor-harness/accepted/` 로 간다.

| 강도 | 작업자 규칙(`STRENGTH_RULES`) | 기계 기준(`chr.STRENGTH`) |
|---|---|---|
| 약함 | 모양 그대로 색만(머리색·옷 색·작은 무늬) | 실루엣 변화 합 ≤30px · 튀어나온 픽셀 0 · 원본과 ≥15% 다름 |
| 보통 | 머리 모양·옷 모양과 무늬, 새 소지품 금지(지금까지의 v-* 규칙) | 튀어나옴 프레임당 ≤10 · 합 ≤60 · ≥20% · 다시 찍은 픽셀 ≥10% |
| 강함 | 머리·옷 형태를 크게, 작은 장신구 허용, 큰 무기·날개 금지 | 튀어나옴 ≤20 · 합 ≤160 · ≥30% · 다시 찍은 픽셀 ≥25% |

「다시 찍은 픽셀」(`chr.redrawn`) = 뼈대 글자마다 가장 많이 옮겨 간 새 글자 하나로 색을 바꿨다고 보고, 그걸로 설명되지 않는 픽셀 비율.
첫 「보통」 조선 병사가 팔레트만 바꾸고 1분 만에 끝내서(0.02) 넣었다. 기존 판정 자료: 색 바꾸기 c-* 0~0.09, 받은 v-* 0.14~0.51.

세 강도 모두 서 있는 자세만 고치고 걸음은 전파한다. RTP 밖 그림은 절대 울타리(48색·24×31·480px)를 넘을 수 있어서(조선 병사 55색,
깃털이 칸 끝까지) 뼈대가 이미 넘은 만큼은 허용한다. `--strength` 는 `check`·`views`·`propagate` 에도 있다.

## 설명 (`desc.json`) — 조수가 NPC 를 고를 때 읽는다 (2026-10-03)
`loop` 끝에 Sonnet 이 그림만 보고(`sheet_x8.png`·`strip.png`·생성 얼굴) `describe.md` 형식으로 쓴다: `label`·`gender`·
`attributes{kind, age, hair}`(정본 `sharedCharacterGraphics.json` 과 같은 칸)·`role`·`appearance`·`colors`·`tags`·`fits`.
지시와 그림이 다르면 그림대로 쓴다. 이미 있는 것은 `describe --accepted`(받은 것만) / `describe --run R` 로 채운다.
받으면 `accepted/<stem>.json` 에 설명·뼈대·강도·파일 이름이 같이 나간다 — 번들 등록 단계의 원본.

## 기계 검수 (`chr.gate`) — 형식을 거르는 것이지 품질 판정이 아니다
처음엔 Actor1 8명에서 잰 고정 기준이었는데 다른 칩셋 원본 64명 중 44명을 떨어뜨렸다(색 있는 윤곽선·47색·2px 출렁임·아이 몸).
지금은 넓은 절대 울타리 + **뼈대 원본 대비** 기준이고, `calibrate` 가 RTP 원본 72명 전원 통과를 확인한다.
절대: 색 ≤48 · 배경 키 색 금지 · 실루엣 120~480px · 크기 ≤24×31 · 걸음 0·2 의 다리가 다름 · 걸음 0↔2 바뀐 픽셀 ≥50 · 걸음 ≠ 서 있는 자세.
뼈대 대비: 프레임마다 실루엣 0.7~1.5배 · 어두운 윤곽 비율이 뼈대보다 15%p 넘게 떨어지지 않음 · 머리 출렁임 ≤ max(1, 뼈대) ·
걸음 동작 ≥ 뼈대의 60% · 뼈대와 다른 픽셀 ≥20%(복사 방지). 경고: 한 프레임에만 나오는 색(깜빡임), 실루엣이 원본과 같음(색만 바꿈), 발끝 줄 어긋남.

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
python3 $H check F.chr.txt --base 0 / views F.chr.txt OUT --base 0 [--strength weak]
python3 $H ingest soldier.png --name "조선 병사" --strength weak,normal,strong --go   # 올린 그림을 뼈대로
python3 $H describe --accepted                       # 받은 것에 설명 채우기
```

## 파일
| 파일 | 하는 일 |
|---|---|
| `harness.py` | 명령들, 작업자 실행(`claude -p` / `codex exec`), 비교 화면, 받기/버리기 서버 |
| `web/index.html` | 받기/버리기 화면 |
| `reviewer.md` | 검수자 지시문 틀 |
| `face.md` | 얼굴 작업자 지시문 틀(손 도트) |
| `describe.md` | 설명 작성자 지시문 틀(desc.json) |
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
