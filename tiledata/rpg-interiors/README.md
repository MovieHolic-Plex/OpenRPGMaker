# RPG 실내 — 여관·민가·교회·길드·마법 상점·공방·도서관·교실·성(1층 대형 포함)·배·투기장·카지노·경매장·기후 집

지형·배치 참고 사례(문 이동·NPC·상점·대사 이벤트 없음). 「장소」 카드와 공용 AI 문서 분류로 배포된다.

| 분류 id | 타일셋 | 맵 |
|---|---|---|
| `rpg-interiors-inn-homes-v1` | tibo_interior_expanded | 여관 1층·2층, 한 칸 집, 2층 집 1·2층, 촌장집, 폐가 |
| `rpg-interiors-civic-v1` | tibo_interior_expanded | 교회 예배당, 모험가 길드, 마법 상점, 연금술 공방, 도서관, 마법 학원 교실 |
| `rpg-interiors-castle-v1` | tibo_interior_expanded | 성 1층(50×40: 알현실·대연회장·복도 고리·계단실·주방·경비 초소), 식당·침실·병영·보물고 |
| `rpg-interiors-leisure-v1` | tibo_interior_expanded | 투기장 대기실, 카지노, 경매장 |
| `rpg-interiors-ship-v1` | easyrpg_chipset_ship | 배 선실, 배 화물칸 |
| `rpg-interiors-climate-v1` | tibo_interior_expanded | 사막 흙벽돌 민가·오아시스 여관 주점, 설원 사냥꾼 오두막·촌장집, 화산 대장장이 집·잿빛 마을 여관 |

| 파일 | 내용 |
|---|---|
| `catalog.json` | 계획(plans: 용도·입구·검사 목표·놓은 소품)·맵 23장·타일셋 둘(Tibo 실내 확장, 배 + Tibo 짐 이식) |
| `validation.json` | 입구에서 목표 칸까지 런타임 `canMove`로 닿는지 + 입구에서 못 가는 맨바닥(주머니) 목록. 저작 스크립트는 하나라도 있거나 배치 규칙(탁상 소품은 탁자 위, 의자는 탁자 곁, 벽걸이는 벽면 안, 가구는 바닥 위)을 어기면 멈춘다 |
| `emptiness.txt` | 빈칸 검사 결과(`/tmp/oprn-qa/emptiness.py --kind interior --plain 42,72,73,102,103,163,222,223,279`) |
| `images/` | 앱 렌더러로 그린 원본 픽셀 그림 |
| `*.md` | 공용 AI 문서 사본(`src/assets/sharedRpgInteriorReferences.json`과 같은 본문) |
| `storage-proof.json` | 정본 `.oprn-projects/rpg-interiors-20260924` 저장·재오픈 증명 |

재생성 순서(dev 서버 `npm run dev:worktree`가 떠 있어야 렌더된다):

```bash
python3 scripts/content/bake-climate-interior-tiles.py      # Tibo 1980~2009 기후 벽면·바닥·모피 깔개(시트를 66행으로 자르고 한 줄 덧붙임)
node scripts/content/register-climate-interior-tiles.mjs    # tiboRecoveredTileset.json 칸 수·통행·라벨·그룹
node scripts/content/author-rpg-interiors.mjs
DEV_URL=http://127.0.0.1:<port> node scripts/content/render-rpg-interiors.mjs
node scripts/content/prepare-rpg-interiors-references.mjs
node scripts/content/externalize-reference-images.mjs   # 번들 JSON의 dataUrl → /assets 경로. 다른 파이프라인 JSON이 같이 바뀌면 되돌린다
node scripts/content/save-rpg-interiors.mjs
node scripts/content/prepare-rpg-interiors-regions.mjs output/evidence/rpg-interiors/reloaded.json
BASE=http://127.0.0.1:<port> node scripts/qa/capture-rpg-interiors.mjs
```

바탕 재료: 벽·천장·칸막이는 `interiorRoomPipeline`(plan/floor/walls, rooms + innerDoors; 맞닿은 방이 있는 성 1층은 openPlan), 소품은 Tibo structureKits를 id로. 세로 칸막이 천장은 북쪽 천장까지 이어 붙인다(파이프라인은 첫 바닥 행에서 멈춘다). 탁상 소품은 나무 상판 오토타일(terrain-deck) 위에만, 계단은 바닥 위 곧은 벽 앞에만.
성 짝: 성 1층 계단실 오르막 → 성 침실(동벽 내리막), 내리막 → 성 보물고(동벽 오르막), 서복도 북쪽 문 틈 → 성 식당 남문, 동복도 북쪽 문 틈 → 성 병영 남문.
배 시트는 실내 칩셋과 천장 번호 배치가 같아서 같은 껍데기에 벽면(74~76→104~106, 104~106→134~136)·바닥(72→279)만 바꾼다.
분류를 고쳐 다시 배포할 때는 분류 id의 `-v1`을 올리고 옛 id를 은퇴 목록에 넣어야 기존 프로젝트에서 교체된다(지금은 추가만 한다).

기후 집(2026-09-25): 사막·설원·화산 마을 집 안이 숲마을 실내(크림 회벽·나무 바닥)를 그대로 쓰던 것을 바꿨다. Tibo 시트 66행(1980~2009)에 기후 벽면 셋(통나무 1980~1985·사암 1986~1991·현무암 1992~1997, 윗줄 왼끝·가운데·오른끝 / 아랫줄)과 현무암 바닥 1998·사암 바닥 1999·흰 모피 깔개 2000~2008(3×3)을 구웠다. 원본 칸의 밝기를 유지하고 색만 바꿨다(통나무는 나무 바닥 72의 결로 새로 그림). 파이프라인 WALL_FACE_RETINT 에 "log"·"sandstone"·"basalt"로 들어 있다(Tibo 전용 번호라 480칸 easyrpg 실내 칩셋용 조수 도구 선택지에는 넣지 않았다). 기존 프로젝트는 extendTiboInteriorDefaults가 칸 수를 늘린다.
기후 집의 위층 계단은 3칸 폭 돌계단 141|111|171 세 줄 — 첫 바닥 줄에서 북쪽 벽면 두 줄을 덮고 오른다(사용자가 맞다고 한 모양, 2026-09-25). 옛 방들의 세로 111/141/171은 그대로 둔다.
