# 판타지 장소 11곳 — 상점·성 내부·마왕성·폐성

지형·배치 참고 사례(문 이동·NPC·상점 이벤트 없음). 「장소」 카드와 공용 AI 문서 세 분류로 배포된다.

| 파일 | 내용 |
|---|---|
| `catalog.json` | 계획(plans: 입구·검사 목표·놓은 소품)·맵 11장·타일셋 셋(tibo 실내 확장, 던전, 숲마을 + Tibo 이식) |
| `validation.json` | 입구에서 목표 칸까지 런타임 `canMove`로 닿는지(저작 스크립트가 실패하면 멈춘다) |
| `sign-labels.json` | 627/628/629 간판 라벨 정정(칼·방패·항아리). `before`가 옛 라벨 |
| `images/` | 앱 렌더러로 그린 원본 픽셀 그림(+ `guide-ruin-holed` 오류 예시) |
| `*.md` | 공용 AI 문서 사본(`src/assets/sharedRpgPlaceReferences.json`과 같은 본문) |
| `storage-proof.json` | 정본 `.oprn-projects/rpg-places-20260923` 저장·재오픈 증명 |

재생성 순서(dev 서버 `npm run dev:worktree`가 떠 있어야 렌더된다):

```bash
node scripts/content/author-rpg-places.mjs
node scripts/content/render-rpg-places.mjs
node scripts/content/prepare-rpg-places-references.mjs
node scripts/content/save-rpg-places.mjs
node scripts/content/prepare-rpg-places-regions.mjs output/evidence/rpg-places/reloaded.json
node scripts/qa/capture-rpg-places.mjs
```

바탕 재료: 실내 벽은 `interiorRoomPipeline`(plan/floor/walls), 던전 벽은 「무너진 납골당」 조립, 외관은 `tiledata/forest-villages/diverse/catalog.json`의 여울성 나루.
분류를 고쳐 다시 배포할 때는 분류 id의 `-v1`을 올리고 옛 id를 은퇴 목록에 넣어야 기존 프로젝트에서 교체된다(지금은 추가만 한다).
