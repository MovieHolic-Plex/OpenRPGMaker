# 재현과 저장

## 위치

- 프로젝트: `oprn-hill-forest-harmony-20260918-a4e1`
- 호스트 프로젝트 폴더: `.oprn-projects/oprn-hill-forest-harmony-20260918-a4e1/`
- 공용 장소 등록: `src/project/forestPlaceReferences.ts`, `src/project/regionReferences/`, `public/assets/region-references/`
- 보존본 13개: `references.json`의 `.oprn.json`을 읽으면 이미지가 포함된 문서를 얻는다.
- 과거 저작: `scripts/asset-gen/complex-forest-plan.mjs`, `author-small-forest-village.mjs`, `plan-high-cliff-village.mjs`, `author-high-cliff-river.mjs`, `plan-cliff-forest-bridge.mjs`.
- 이번 10종: `scripts/asset-gen/plan-village-ten.mjs`, `author-village-ten.mjs`, `save-village-ten-remote.mjs`와 `scripts/qa/capture-village-ten.mjs`.

## 절차

1. 루트 AGENTS와 OpenWiki의 환경/저장 규칙을 읽는다. 이 자료에는 키를 저장하지 않는다.
2. LegacyDb URL·키·project id와 실제 load를 확인한다. 로컬 SQLite와 원격 원본은 서로 다를 수 있으므로 각각 별도의 작업 전 사본을 둔다.
3. 저장된 승인 칩셋의 이미지 해시·16px·열 수·메타데이터를 읽는다.
4. 새 map id에 마스크/정점/집 발자국 계획을 만든다. 이전 맵에 실험을 덮어쓰지 않는다.
5. 실제 편집기 `store.update` 및 `paintTilesBulk`로 저작한다. `scope/origin/label`을 기록한다. HMR 중에는 resource URL을 통해 현재 store 모듈을 import한다.
6. 실제 `canMove` 및 오토타일 엔진으로 검증하고 `store.flush` 후 재로드한다.
7. LegacyDb 원본을 다시 읽고 새 맵만 CAS 저장한다. 기존 맵·자산이 바뀌지 않은 것을 확인한다.
8. 실제 편집기의 `mapOnlyCapture=1` 화면을 `__oprnEditWorldToClient` 좌표로 잘라 전체 이미지를 얻는다. 렌더 함수를 흉내 낸 그림을 실제 화면이라고 하지 않는다.
9. 마을마다 이미지와 수치, 저장 근거를 남긴다.

편집기 UI QA와 게임 런타임 QA는 다르다. 게임 플레이 검증에는 `npm run qa:runtime` 전용 하네스를 따른다. AGENTS에서 금지한 gates/Vitest/전체 typecheck/stash를 임의로 실행하지 않는다.

## 다시 실행할 때

저작 스크립트의 `local-before.json`은 해당 작업 직전의 비교 기준이다. 사용자 편집 뒤에 오래된 사본으로 다시 실행하면 안 된다. 이미 발행한 `oprn-place-…-v1` 스냅샷은 불변이며 새 개정으로 저장한다. 서버 포트는 세션마다 바뀔 수 있으므로 하드코딩된 과거 브라우저 포트를 현재 포트라고 가정하지 않는다.
