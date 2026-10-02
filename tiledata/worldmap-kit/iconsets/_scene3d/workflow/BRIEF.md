# 월드맵 아이콘 세트 작업지시서 (공통)

너는 OPRN 16px 월드맵 아이콘 **세트 하나**를 3D 장면 렌더러로 만드는 작업자다. 세트 id·테마·역할별 내용은 따로 받은 세트 지시에 있다.
이 지시문과 세트 지시가 전부다 — 저장소의 AGENTS.md·CLAUDE.md·openwiki 는 읽지 않아도 된다.

## 작업 폴더 — 여기에만 쓴다
`~/wmi-sets/<세트 id>/` (이미 `build.py` 가 있다). `scenes.py` 를 쓰고(맨 위에 `sys.path.insert(0, '/home/main/z-project/rpg-zzu-worldmap-iconsets/tiledata/worldmap-kit/iconsets/_scene3d')` — 상대 경로 금지) `python3 build.py` 로 찍는다.
**저장소(`/home/main/z-project/...`) 안의 파일은 읽기만 한다.** git·npm·테스트·다른 에이전트 띄우기 금지. 생성 이미지(이미지 모델) 금지 — 전부 코드로 지은 3D 장면이다.

## 도구 — 공용 렌더러 `_scene3d` (읽기 전용)
경로: `/home/main/z-project/rpg-zzu-worldmap-iconsets/tiledata/worldmap-kit/iconsets/_scene3d/`
- `buildset.py` — 빌더. **카메라·칸 맞춤·시트·manifest 는 빌더가 한다.** 너는 장면만 짓는다. 맨 위 설명을 먼저 읽어라.
- `oblique.py` — 레이캐스터. `Scene()`, `s.box(x0,x1,y0,y1,z0,z1, mat=, tex=, role=, contour=True, decals=(...))`, `ob.hip`, `ob.gable`, `s.cyl`, `s.cone`, `ob.Cone`, `s.patch`. 재질 `ob.MAT`, 결 tex: 'brick' 'shingle' 'plank' 'plain' 'fn' …
- `east.py` — 동양식: `E.tile_roof`(오목 기와지붕), `E.hall`(전각), `E.Ellip`(타원체: 수관·구름·바위), `E.InvCone`(떠 있는 섬 밑), `E.oct_prism`/`E.oct_roof`(팔각탑), `E.pillars`, `E.gate_wall`, `E.hull`, `E.sail`.
- `modsf_kit.py` — 현대·SF: `M.bldg`(창 격자 건물), `M.house_flat`, `M.house_gable`, `M.tree_round`, `M.Dome`, `M.Frustum`, `M.dish`, `M.steam`, `M.windows`, `M.container`, `M.watch_tower`, `M.rubble`, `M.broken` …
- `parts.py` — `P.wall`(성벽+총안), `P.gatehouse`, `P.corner_tower`, `P.house`(기와집), `P.tree`, `P.thatch_hut`, `P.yurt`, `P.court_fn`, `P.merlons`.
- `icons_v9_lib.py` — 색 램프(EasyRPG World.png 에서 뽑은 STONE·WOOD·ROCK·RED·BLUE·SNOW·LEAF·VOLC·LAVA·WATER·SAND·GOLD·GREY …), `hx('rrggbb')`, `_reg(ramp, 윤곽색)`.

**견본(꼭 먼저 읽고 화풍을 맞춘다):**
- `/home/main/z-project/rpg-zzu-worldmap-iconsets/tiledata/worldmap-kit/iconsets/monster/scenes.py` — 이 규약대로 쓴 첫 세트(정면 카메라).
- `.../iconsets/desert-east/lib/scenes_a.py`, `scenes_b.py` — 동양·사막 장면 22개(결이 좋다고 사용자가 받은 그림). 부품 쓰는 법을 여기서 배운다.
- `.../iconsets/modern-sf/lib/scenes_a.py`, `scenes_b.py`, `modsf_kit.py` — 현대·SF 장면.
- 원래 그림 미리보기: `.../iconsets/desert-east/preview/*.png`, `modern-sf/preview/*.png`.
- 시점 기준: `~/.local/share/oprn/worldmap-icon-harness/ref-easyrpg-x4.png` (원본 EasyRPG 월드 시트의 마을·성·탑·화산).

## scenes.py 규약
```python
SET = dict(id='<세트 id>', name='<한국어 이름>')          # 선택: max_new_colors(기본 24)
ORDER = [(역할, '아이콘 이름', '함수 이름', (칸w, 칸h), '설명 한 줄'), ...]
def 함수이름(): s = Scene(); ...; return s              # 장면만 돌려준다(렌더·칸 맞춤은 빌더)
```
- 17 역할(칸 수 고정)을 **모두** 덮는다: capital 6x6 · fort_city 4x4 · harbor_city 5x4 · castle 3x3 · large_town 3x3 · village 2x2 · camp 2x2 ·
  tower_small 1x2 · tower_great 2x4 · cave 2x2 · ruin 2x2 · ruin_city 4x3 · shrine 3x3 · landmark_nature 3x3 · circle 2x2 · volcano 2x2 · floating 5x4.
  세트 지시에 「변형」이 있으면 같은 역할로 한 줄 더 넣는다(총 20~24장).
- 월드 좌표: x 오른쪽, y 안쪽(클수록 **뒤** = 화면 위), z 위. 1 단위 = 1px. 칸 하나 = 16px.
- **땅 바닥 패치를 깔지 않는다** — 아이콘은 지도 지형 위에 얹힌다(빈 곳은 키색). 성 안뜰·광장처럼 담 안 바닥만 예외.
- 내용이 칸을 넘치면 빌더가 문제로 보고한다 → 장면을 줄인다. 칸을 거의(가로 85~100%) 채운다. 빌더가 땅 그림자를 오른쪽 아래로 3~4px 더 그리니 그만큼 여유를 둔다.

## 카메라 = 정면 3/4 (빌더 기본, 바꾸지 않는다)
KX=0(카메라가 정남쪽 → 동·서 옆면은 화면에 0px), KY=.62, 빛 왼쪽 위.
그래서 **장면을 정면용으로 짓는다**: 뒤 건물은 앞 건물 바로 뒤에 일렬로 두지 말고 좌우로 엇갈리게, 성 안 건물은 기단을 높여 앞 성벽 위로 머리가 보이게.
옆면을 손으로 칠해 깊이를 흉내 내지 않는다(그게 아이소메트릭이다). 명암은 렌더러가 면 방향으로 정한다.

## 색
기본은 `ob.MAT` 와 icons_v9_lib 램프(EasyRPG World 색)·modsf_kit 재질. 테마에 꼭 필요한 새 재질은 scenes.py 안에서 `ob.MAT['이름'] = [어둠→밝음 5~7색]` 으로 더하고
`icons_v9_lib._reg(ramp, 윤곽색)` 로 윤곽색을 등록한다. **새 색(World.png 에 없는 색) 합계 24개 이하** — 빌더가 센다. 반투명 없음.

## 스스로 검수 — 최소 2바퀴
1. `python3 build.py` → `build-report.json` 의 problems 가 빈 배열이어야 한다.
2. `preview/sheet-4x.png` 와 `preview/<함수>-8x.png` 를 **이미지 보기 도구로 연다**(Claude 는 Read). 시점 기준 그림과 나란히:
   - 1배(게임 크기)에서 무슨 장소인지 한눈에 읽히나(덩어리·실루엣·대표 색). 세부보다 실루엣.
   - 결이 있나: 지붕 줄·벽돌·창·명암 단. 큰 단색 판·블록 장난감이면 결(tex)·부품을 더한다.
   - 같은 세트끼리 화풍·색감·크기감이 맞나. 견본(monster·desert-east)과 크기감이 맞나.
   - 아이콘끼리 서로 달라 보이나(같은 역할 변형은 특히).
3. 고치고 다시 찍는다. 끝나면 `NOTES.md` 에 아이콘마다 한 줄(무엇을 지었나)과 남은 아쉬움을 적는다.

## 마지막 답
세트 id, 아이콘 수, problems 0 여부, 가장 자신 없는 아이콘 2~3개와 이유. 짧게.
