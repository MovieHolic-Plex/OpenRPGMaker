# 3/4 시점 재작도 2판 — 작업자 절차서 (2026-10-01)

사용자 판정: 고른 결과를 시트에 구운 뒤(#1796) 보니 실내 가구 50종이 3/4 시점(윗면 + 앞면)을 안 지킨다.
목록·이유: `tiledata/hand-interior/pick/v34-redo.json` 의 `workers.<너>` (감독자가 번호를 준다: w40~w46).
그림으로 본 목록: http://mdc-server:18301/interior-view34-violations.html

너는 항목마다 **3/4 후보 하나(`<너>-A.pxg`)** 를 찍는다. 자신 있는 다른 방향이 있으면 `<너>-B.pxg` 를 더 내도 된다(선택).

저장소 루트 = 감독자가 지시문에 준 격리 워크트리. 명령은 전부 루트에서 돈다. 항목에 `hint` 가 있으면 그 지시가 아래 일반 규칙보다 먼저다(2판 w51~ 부터).

## 0. 먼저 읽을 것
1. `tiledata/atlas-pick/modern-style-bible.md` **§11(실내 3/4 — T/F 표)** 와 §10-1(원리)·§10-4(금지). 이번 작업의 법이다.
2. 증명 그림 `tiledata/atlas-pick/style-demo-view34/interior-old-*.png`(틀린 것)·`interior-new-*.png`(맞는 것: 옷장·책장·벽난로·사물함). 반드시 열어 본다.
3. `tiledata/hand-interior/pick/WORKER.md` §3(파일 규약)·§4(캔버스·색 규칙)·§5(절차). **단, §1 의 「키 큰 가구는 윗판 1~2px」 은 폐기됐다 — §11 이 대체한다(윗면 T 4~6px).**
4. `scripts/content/pixel-harness/pxgrid/README.md` — 격자 형식.
5. 항목의 `current`(사용자가 지금 쓰는 판 — v5 또는 사용자가 고른 후보)와, 있으면 `existingV34`(9월 30일 1판 3/4 후보, 사용자는 아직 안 골랐다).

## 1. 무엇을 바꾸나
- **모양·용도·색 성격·칸 수는 `current` 그대로.** 사용자가 고른 디자인을 지킨다. 바꾸는 것은 시점 하나 — 윗면 T 와 앞면 F.
- §11-1 표:
  - 벽 붙은 키 큰 가구(진열장·책장·선반·옷장·서랍장·시계·벽난로·화덕·오르간 …): 맨 위에 **윗면 T 4~6px**(벽 쪽으로 보이는 뚜껑, 앞면보다 한 단 밝은 면) → **앞 가장자리 하이라이트 1행** → **처마 그림자 2px** → 그 아래 **들어간 앞면**(선반 칸·문·서랍은 1~2px 안쪽 그림자, 물건은 선반 안에 앉는다).
  - 상자·통·건초: 윗면 4~8px(뚜껑·입구) + 앞면 8~16px.
  - 탁자: 상판이 깊이의 0.5~1.0배(8~14px) + 다리·측면.
  - 의자·회중석: 좌판 윗면 4~6px 이 보이고 등받이는 좌판 뒤에서 솟는다. 동쪽을 보는 회중석(pew E2/E3)은 **옆으로 놓인 긴 의자를 위에서 약간 내려다본 모습** — 좌판 윗면 띠가 길게 보이고 등받이는 서쪽 끝 세로 막대. 지금은 옆 단면 막대뿐이다.
  - 침대(짚 침대): 탑다운이라 **앞면(침대 틀·짚 단면 4~6px)** 을 붙인다.
- `existingV34` 가 있으면 먼저 본다. 계약을 지키고 눈으로 좋으면 **그걸 출발점으로** 더 다듬어도 된다(복사 후 수정). 아니면 `current` 에서 새로 그린다.
- 세부를 늘려서 이기려 하지 마라. 16px 에서 읽히는 덩이 몇 개가 잔점 스무 개보다 낫다. 빛은 왼쪽 위, 윤곽은 그 재료의 어두운 단.
- **캔버스·접지선은 `current` 와 같다**(v5 칸 자리, WORKER.md §4). 위로 윗면을 얹을 자리가 모자라면 앞면을 살짝 줄여 만든다 — 캔버스를 키우지 마라. 정말 안 되면 감독자에게 「<slug> 를 w×h 로, 이유」로 보고만 한다.
- **진열장(cabinet:*) 13종**은 한 몸통의 변형이다(담긴 물건만 다르다). 몸통을 한 번 3/4 로 정하고 13종 전부 같은 몸통 + 각자 물건을 선반 안에 앉힌다. 물건은 `current` 그림의 물건 화소를 옮긴다.

## 2. 애니메이션 기물 (fireplace · forge · stove · fish tank · rune stone · slot machine · magitek engine)
- 항목에 `animated` 가 있다. `anim-mask.png`(캔버스 크기, 흰 화소 = 12프레임 동안 바뀌는 화소)와 `anim-region-x6.png`(v5 위에 그 자리를 자홍으로 칠한 6배 그림)를 본다.
- **움직이는 자리(불·물·릴·빛)는 v5 와 같은 화소 좌표에 그대로 둔다.** 감독자가 그 마스크 화소를 v5 의 프레임별 화소로 다시 칠해 12프레임을 만든다. 마스크 자리에는 v5 프레임 0 색을 그대로 둔다.
- 몸통(화덕 틀·수조 유리·기계 몸체)만 3/4 로 바꾼다. 마스크 바깥만 고친다. 윗면은 마스크 위쪽에 얹는다.

## 3. 항목마다
```bash
S=tiledata/hand-interior/pick/candidates/<slug>
cat $S/info.json
cp $S/<current> $S/<너>-A.pxg          # 또는 existingV34 에서 시작
#   … 격자를 고친다 …
echo "한 줄 메모(무엇을 바꿨나)" > $S/<너>-A.note
python3 scripts/content/hand-interior-pick/check_candidate.py $S/<너>-A.pxg      # 렌더+색·캔버스 검사(hard 불합격은 고친다)
python3 scripts/content/atlas-pick/interior_view34_audit.py <gate> $S/<너>-A.png  # 3/4 관문: 항목의 gate(--wall-tall / --object). ok 가 나와야 한다
python3 scripts/content/hand-interior-pick/context.py $S/<너>-A.pxg              # 방 안 맥락 → $S/<너>-A.ctx.png (4배)
```
- 관문 판정이 `ok` 가 아니면 다시 그린다. 단, 회중석·짚 침대·마도 기관·탁자처럼 측정이 약한 것은 관문이 틀릴 수 있다 — 그때는 메모에 「관문 X, 눈 판정 O, 이유」를 적는다.
- **눈 검수 2회(적대적으로).** `-x4.png` 와 `.ctx.png` 를 열어 본다.
  1회: 「`current` 와 같은 물건으로 읽히나? 정면 도면 같지 않나? 윗면이 그냥 얇은 띠 아닌가? 윗면이 앞면보다 커져 탑다운이 되지 않았나?」
  2회(고친 뒤): 「방 바닥·벽·옆 가구와 명도·윤곽이 튀지 않나? 접지선·그림자가 맞나?」
- 한 항목에 25분 넘기지 마라.

## 4. 금지
- 다른 작업자 파일·`current`·`v5.*`·`info.json`·`palette.pal`·`picks.json`·`anim-mask.png` 수정 금지. 네 `<너>-*` 파일과 `$S/work/<너>-*` 만 만든다.
- **git add/commit/stash, npm test, vitest, gates 금지.** 감독자가 모은다.
- REFMAP 등 제3자 그림의 화소를 옮기지 마라(검사가 잡는다).

## 5. 끝나면
```bash
python3 scripts/content/hand-interior-pick/check_candidate.py --worker <너>
```
감독자에게 짧게: 항목별 한 줄(관문 판정 t/f, 눈 판정, 메모), hard 불합격·관문 미통과 목록, 캔버스가 모자랐던 항목. 경로는 절대 경로.
