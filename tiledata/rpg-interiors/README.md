# RPG 실내 22곳 — 여관·민가·교회·길드·마법 상점·공방·도서관·교실·성·배·투기장·카지노·경매장

지형·배치 참고 사례(문 이동·NPC·상점·대사 이벤트 없음). 「장소」 카드 22장과 공용 AI 문서 다섯 분류로 배포된다.

| 분류 id | 타일셋 | 맵 |
|---|---|---|
| `rpg-interiors-inn-homes-v1` | tibo_interior_expanded | 여관 1층·2층, 한 칸 집, 2층 집 1·2층, 촌장집, 폐가 |
| `rpg-interiors-civic-v1` | tibo_interior_expanded | 교회 예배당, 모험가 길드, 마법 상점, 연금술 공방, 도서관, 마법 학원 교실 |
| `rpg-interiors-castle-v1` | tibo_interior_expanded | 성 식당·침실·병영·보물고 |
| `rpg-interiors-leisure-v1` | tibo_interior_expanded | 투기장 대기실, 카지노, 경매장 |
| `rpg-interiors-ship-v1` | easyrpg_chipset_ship | 배 선실, 배 화물칸 |

| 파일 | 내용 |
|---|---|
| `catalog.json` | 계획(plans: 용도·입구·검사 목표·놓은 소품)·맵 22장·타일셋 둘(Tibo 실내 확장, 배 + Tibo 짐 이식) |
| `validation.json` | 입구에서 목표 칸까지 런타임 `canMove`로 닿는지 + 입구에서 못 가는 맨바닥(주머니) 목록. 저작 스크립트는 하나라도 있으면 멈춘다 |
| `images/` | 앱 렌더러로 그린 원본 픽셀 그림 |
| `*.md` | 공용 AI 문서 사본(`src/assets/sharedRpgInteriorReferences.json`과 같은 본문) |
| `storage-proof.json` | 정본 `.oprn-projects/rpg-interiors-20260924` 저장·재오픈 증명 |

재생성 순서(dev 서버 `npm run dev:worktree`가 떠 있어야 렌더된다):

```bash
node scripts/content/author-rpg-interiors.mjs
DEV_URL=http://127.0.0.1:<port> node scripts/content/render-rpg-interiors.mjs
node scripts/content/prepare-rpg-interiors-references.mjs
node scripts/content/save-rpg-interiors.mjs
node scripts/content/prepare-rpg-interiors-regions.mjs output/evidence/rpg-interiors/reloaded.json
BASE=http://127.0.0.1:<port> node scripts/qa/capture-rpg-interiors.mjs
```

바탕 재료: 벽·천장·칸막이는 `interiorRoomPipeline`(plan/floor/walls, rooms + innerDoors), 소품은 Tibo structureKits를 id로.
배 시트는 실내 칩셋과 천장 번호 배치가 같아서 같은 껍데기에 벽면(74~76→104~106, 104~106→134~136)·바닥(72→279)만 바꾼다.
분류를 고쳐 다시 배포할 때는 분류 id의 `-v1`을 올리고 옛 id를 은퇴 목록에 넣어야 기존 프로젝트에서 교체된다(지금은 추가만 한다).
