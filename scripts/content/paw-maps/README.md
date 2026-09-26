# paw-maps — PAW (ドット絵世界) 맵 모음 생성기

그림 파일은 재배포 금지다. 이 폴더에는 **코드만** 둔다. 렌더 PNG/JSON 은 `~/claude-viz/paw-maps/` 에만 쓴다.

## 실행
    python3 scripts/content/paw-maps/run_all.py            # 전부
    python3 scripts/content/paw-maps/run_all.py m12 m13    # 일부
출력 마지막 줄 `OK n FAIL k distinct-sheets s` 가 판정값이다.

## 맵 파일 규칙
- 파일 하나 = 맵 하나: `mNN_slug.py` (NN 두 자리, 테마별 번호대: A 01-19, B 20-34, C 35-49, D 50-64).
- 머리 두 줄:
      import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
      from pawlib import *
- `Map(id, 한국어 제목, w, h, kind, note)` → 배치 → `m.save()`.

## 엔진 (pawlib.py)
- `auto('SA-xxx.png')` : XP 오토타일(96x128, 애니 384x128). 같은 auto 로 칠한 이웃 칸끼리 자동으로 테두리가 이어진다.
  바닥/길/물/담/지붕 면처럼 넓은 영역은 반드시 auto 로 `m.fill(x,y,w,h, auto(...))`.
- `tile(sheet, index)` / `tile(sheet, col, row)` : 시트의 32px 칸 하나. `m.fill(..., tile(...))` 로 반복, `m.put(x,y,tile)` 로 위층 하나.
- `m.rect(sheet, sx, sy, w, h, x, y)` : 시트의 (sx,sy)부터 w×h 칸 블록을 통째로 위층에 복사. **여러 칸짜리 물건은 반드시 통째로** 복사한다(잘린 나무·잘린 건물 금지).
- `m.recipe(sheet, recipe_id, x, y)` : 저장소 사전에 있는 검증된 조립 단위(catalog.json `recipes[sheet][id].rect`).
- `m.chip('sakura2.png', x, y)` : by-source/sozai/chips 의 칩 시트 전체(한 그림짜리 소품).
- `m.image(sheet, x, y, box)` : 32 배수가 아닌 시트(캐릭터 32x48, 문 등)는 픽셀 상자로.

## 자료 (그림 없이 고르는 법 — 서브에이전트는 이미지를 볼 수 없다)
- `catalog.json` : `sheets[name] = {path,w,h,cols,rows}`, `recipes[sheet][id] = {rect:{x,y,width,height} (타일 단위), kind, name}` (648개).
- `sheetmaps/<sheet>.txt` : 시트 칸마다 불투명도(`.`비어있음 `~`적음 `+`중간 `#`꽉참)+대표색 글자. 연속된 `#` 덩어리 = 한 오브젝트/바닥면.
  빈 칸(`.`)으로 둘러싸인 덩어리 경계를 따라 통째로 rect 한다.
- `../../../tiledata/pixel-art-world/*.md` 와 `*-layout.json` : 시트별 사람이 쓴 의미 사전(학교·저택·레트로·실내 등). **먼저 해당 MD 를 읽고** 거기 적힌 좌표를 우선 쓴다.
- `theme_<A|B|C|D|SHARED>.txt` : 테마별 담당 시트 목록. SHARED(캐릭터)는 누구나 소수 배치 가능.

## 품질 기준 (감독자가 1:1 로 눈검사한다)
- 맵은 한 용도로 읽혀야 한다(가게, 골목, 교실…). 크기는 실내 12x10~24x18, 실외 24x18~48x36.
- 바닥 전면을 먼저 깐다(검은 빈 칸 금지; 실내 벽 밖은 검정 허용).
- 실내: 윗벽(벽면 2~3행) → 바닥 → 가구. 가구는 벽에 붙이고 통로 1칸 이상.
- 한 맵 안에서는 서로 어울리는 시트만(같은 계열 실내 시트 + 그 시트용 바닥/벽 오토타일).
- 여러 칸 물건 잘림 금지, 물건끼리 겹침 금지, 같은 물건 기계적 반복 줄 금지.
