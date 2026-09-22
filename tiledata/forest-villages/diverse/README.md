# 다양한 숲마을: 공용 지역과 AI 참고문서

이슬여울은 보존하고 빈 지면에서 새로 만든 외관 참고 맵 3개다. 공용 「지역 → 기본 설계」에 등록하며 「장소」의 부분 사례와 혼동하지 않는다.

| 맵 | 크기 | 집 | 지형·동선 |
|---|---|---|---|
| 솔바람 흩어진 산촌 | 80×64 | 7 | 두 둔덕, 떨어진 집, 가지 길과 샘 |
| 층바위 절벽마을 | 88×72 | 8 | 세 높이의 대지, 네 계단, 절벽 아래 마당 |
| 갈대물굽이 포구 | 88×64 | 8 | 남·동쪽 물굽이, 골목, 긴 선착장 |

## 정본과 재현

SQLite 프로젝트 ID: `44d88b94-58eb-4dee-a11a-88737da7001b`.
작업 정본 폴더: `.oprn-projects/village-diversity-20260923` (개인 DB는 git 미포함).
새 프로젝트에 저장한 뒤 같은 폴더를 다시 열어 맵 배열·칩셋 이식·참고문서를 확인했다.
이슬여울 프로젝트 `31250868-3eb7-42c9-a1f6-bd7d1d8e8245`는 저장 전후 JSON 값이 같다.
근거: `verify-shots/village-diversity/storage-proof.json` 및 `README.md`.

- `catalog.json`: 동결한 세 맵, 합성 칩셋, 지형 입력, 집·소품 좌표.
- `part-dictionary.json`: 실제 사용 타일 232개의 원본/합성 좌표, 메타데이터와 통행.
- `*-rows-*.md`: 상위·하위 전체 배열. 각 문서는 최대 16행.
- `cliff-assembly.md`, `forest-assembly.md`: 결합 순서, 반복과 마감, 층·방향·접근칸.
- `validation.md`, `validation.json`, `images/`: 정상 및 의도적으로 손상한 5종 비교.
- `images/`는 원본 렌더, `public/assets/diverse-village-references/`는 열람용 축소본. 축소 그림을 게임 타일로 잘라 쓰지 않는다.

```bash
# 새 저작을 재현할 때만. 이슬여울 정본에서 읽기 전용 export를 먼저 얻는다.
node scripts/content/author-diverse-villages.mjs source-project.json output/new-villages
# 현재 동결 표본의 오류 좌표 확인. 임의 마을의 미적 점수를 매기지 않는다.
node scripts/content/validate-diverse-villages.mjs project.json terrace-cliff-village
# 개발 서버가 켜진 상태에서 실제 타일 렌더 및 의도적인 오류 비교 생성
DIVERSE_DEV_URL=http://127.0.0.1:9816 node scripts/content/render-diverse-village-evidence.mjs
# 번들 생성 — 원격/프로젝트 저장 없음
node scripts/content/prepare-diverse-village-references.mjs
# 반드시 정본 저장/재로드를 마친 export만 배포
node scripts/content/prepare-diverse-village-regions.mjs reloaded-project.json 44d88b94-58eb-4dee-a11a-88737da7001b
# 실제 지역 목록·속성·다운로드 및 AI 전체 행 조회 관측
BASE=http://127.0.0.1:9816 node scripts/qa/capture-diverse-village-regions.mjs
```

공용 참고문서는 `src/assets/sharedDiverseVillageReferences.json`을 `forestHarmony.ts`의 생성자와 `ensureForestHarmonyReferences`가 소유한다. 별도 등록 스크립트로 몇몇 프로젝트 행에만 넣고 끝내지 않는다. 기존 작성자의 문서와 `referenceSourceTilesetId`는 보존한다. 다운로드에는 해당 맵과 필요한 이식, 통행, 이 참고문서 용도를 포함한다.

## 출처와 한계

새 그림을 생성하거나 원본 나무 몸통을 다시 그리지 않았다. 기존 번들의 `tex_forest_harmony`, `tex_forest_cliff_reference`, `tex_shared_forest_village_objects`, `tex_easyrpg_chipset_retro_world`를 사용한다. 그림의 기존 출처/라이선스는 `public/assets/ATTRIBUTION.md`, `public/assets/easyrpg/COPYING`, 기존 `tiledata/tilesets/forest_harmony/dewbank-village/` 자료를 따른다. 이 문서와 좌표 설계가 신규 저작이다.

절벽 2670..2690은 이 세 맵의 명시적 이식 번호다. 일반 forest_harmony의 그 번호가 같은 그림이라고 가정하지 않는다. 다른 프로젝트의 빈 슬롯으로 옮길 때는 사전과 전체 배열을 함께 재매핑한다.

집 문앞·계단 양끝·동굴 접근칸·선착장 끝까지 엔진 타일 통행을 확인했다. 실내·NPC·문 전이 이벤트와 게임 전체 플레이 검증은 포함하지 않는다. 자동 검증은 동결 표본의 배열·이식과 접근 경로 비교이며 임의 마을을 판정하는 범용 생성 검증기가 아니다.
