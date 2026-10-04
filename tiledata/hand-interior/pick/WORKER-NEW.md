# 새 기물 그리기 — 작업자 절차서 (2026-10-01)

v5 381종에 없는 기물을 새로 찍는다. 명세: `tiledata/hand-interior/new/items.json`(id·이름·분류·kind·칸 수·캔버스·설명·contextRoom).
후보 폴더는 이미 준비됐다: `candidates/<slug>/`(info.json·palette.pal·빈 v5.pxg = 캔버스 크기 투명 격자).
너는 배정받은 기물마다 `candidates/<slug>/<너>-A.pxg` 하나(자신 있으면 다른 해석 `<너>-B.pxg`)를 찍는다. 사용자가 18302 에서 「새 기물」로 보고 고른다.

## 먼저 읽을 것
1. `tiledata/atlas-pick/modern-style-bible.md` §10(3/4 원리·금지)·§11(실내 3/4 T/F 표) — **이번 작업의 법**. 증명 그림 `tiledata/atlas-pick/style-demo-view34/interior-new-*.png`.
2. `tiledata/hand-interior/pick/WORKER.md` §3~§5(파일 규약·캔버스·색 규칙·절차), `scripts/content/pixel-harness/pxgrid/README.md`(격자 형식).
3. **화풍 기준 = 같은 방의 기존 기물.** 배정 기물의 contextRoom 방 그림(`tiledata/hand-interior/v5/v5_<방>.png`)을 열고, 같은 재질·같은 종류의 기존 기물 후보를 본다
   (예: 나무 가구는 `candidates/wardrobe/w42-A.png`·`candidates/bookshelf_1w/w41-A.png`, 돌은 `candidates/column_stone/w51-A.png`, 쇠는 `candidates/column_steel/w51-A.png`, 천은 `candidates/bed_green/pilot-A.png`).
   그 결(6단 명암·윤곽선 = 재질의 가장 어두운 단·빛은 왼쪽 위)을 따라 한다. 팔레트는 폴더의 palette.pal 만.

## 3/4 계약 요약
- 벽 붙은 키 큰 기물(kind wall, 사다리·서랍장·닻·침상·침대): 맨 위 윗면 T 4~6px(앞면보다 한 단 밝음) → 앞 모서리 하이라이트 1행 → 그 아래 앞면. 침대는 매트·이불 윗면이 넓게 보이고 발치 쪽 앞판이 4~6px.
- 바닥 기물: 상자·금고·관·석관은 윗면(뚜껑) 4~8px + 앞면. 탁자·책상은 상판 깊이 0.5~1.0. 원기둥(창꽂이 통·조타륜 기둥)은 위 타원 입구 + 원통 명암.
- 걸이(hang)는 벽에 붙은 판 — 윗면은 없거나 얇은 위 테 하나. 앞으로 튀어나온 것(활·방패)은 아래쪽에 1px 그림자.
- flat(짚 더미·뚜껑문)은 바닥에 누운 것 — 위에서 본 모양 그대로, 앞면은 0~1px.
- 정면 도면·순수 탑다운 금지. 세부를 늘리지 말고 16px 에서 읽히는 덩이 몇 개로.
- 캔버스·칸 수는 items.json 그대로. 아래쪽이 발밑 칸, 그 위가 솟는 부분(겹침층). 접지 그림자는 발밑 칸 아래 끝.

## 항목마다
```bash
S=tiledata/hand-interior/pick/candidates/<slug>
cat $S/info.json
cp $S/v5.pxg $S/<너>-A.pxg      # 빈 격자에서 시작
# … 격자를 찍는다 …
echo "한 줄 메모" > $S/<너>-A.note
python3 scripts/content/hand-interior-pick/check_candidate.py $S/<너>-A.pxg                       # hard 0
python3 scripts/content/atlas-pick/interior_view34_audit.py --object $S/<너>-A.png                  # wall 이면 --wall-tall. 걸이·flat 은 생략
python3 scripts/content/hand-interior-pick/context.py $S/<너>-A.pxg                               # contextRoom 에 임시로 놓은 방 그림 → $S/<너>-A.ctx.png
```
- 눈 검수 2회(적대적): 1회 「16px 에서 그 물건으로 읽히나, 3/4 인가(정면도·탑다운 아닌가)」, 2회 「방 안에서 옆 기존 기물과 화풍·명도·크기가 맞나」.
- 한 항목 25분 넘기지 마라. 관문이 형태를 못 재면 메모에 「관문 X, 눈 O, 이유」.

## 금지
다른 작업자 파일·v5.*·info.json·palette.pal·items.json·picks.json 수정, REFMAP 등 제3자 그림 화소 옮기기, git add/commit/stash, npm test, vitest, gates.

## 끝나면
`python3 scripts/content/hand-interior-pick/check_candidate.py --worker <너>` 후 한국어로 짧게: 항목별 한 줄(관문·눈 판정·메모), 불합격·애매한 것, 배정 전체를 한 장에 모은 확인 그림 경로(절대 경로).
