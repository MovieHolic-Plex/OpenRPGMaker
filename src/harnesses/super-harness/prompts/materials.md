# 승인된 기획을 재료로 연결

`{{CDIR}}/planning.json`과 `planning-reviews/A.json`, `B.json`을 먼저 읽는다.
`python3 {{ROOT}}/src/harnesses/super-harness/gates.py planning {{CDIR}}`의 ok가 true여야 조사한다.
반환 fingerprint를 materials.json의 planningFingerprint에 넣는다.
기획의 모든 변형 id/worldviewId/layout/spaceProfile을 유지하고, requirements의 id/role/what을 하나도 빼거나 변경하지 않는다.
구역·동선에 맞춰 필요한 재료를 추가할 수 있다. 기획 자체를 바꿔야 하면 결과를 위조하지 말고 사유를 남겨 반려한다.

# 맵을 짓기 전 재료 조사

대상: {{CONCEPT}}
저장소(읽기 전용): {{ROOT}}
출력 폴더: {{CDIR}}
세계관 이름과 소유 칩셋: {{WORLDVIEWS}}

맵·예제·평면을 만들지 않는다. 먼저 공간의 시대/문화, 반드시 있어야 그 공간으로 읽히는 재료,
벽·바닥·천장·기둥·문·이벤트 상태 그림까지 실제 재고를 조사한다.
교실=책상/의자/칠판, 하수도=물길/둑/연결부, 주차장=콘크리트/기둥/주차선/차량/진입부처럼 핵심을 빠뜨리지 않는다.
조선 주막에 중세 식탁·벽난로를 쓰거나, 주차장을 중세 돌벽으로 먼저 짓는 것은 금지한다.
`needsArt` 구조 초안도 만들지 않는다.

재고의 현재 원본을 찾아라. `src/assets/handInteriorSpec.json`, 공용 타일셋 정의/키트/참고문서,
`openwiki/harnesses/joseon-baram.md`와 실제 조선 실내 목록·관문을 읽는다.
시드의 설명만으로 '없다'고 단정하지 않는다. 조선 하네스에는 실내 표본이 존재하지만 현재 해시의 검수와 공용 배포 여부를 확인해야 한다.
실제 칩 PNG와 해당 용도의 MD/조립 지침을 모두 열어 본다. 객체 이름 존재만으로 사용 가능하다고 하지 않는다.
새 그림이 필요하면 올바른 전용 하네스와 부족분을 적는다. 미검수 후보/원격에만 있는 자료는 사용 가능 재고가 아니다.

`materials.json`:
```json
{
  "version": 2, "concept": "폴더 이름과 같은 id",
  "variants": [{
    "id": "변형 id", "worldviewId": "modern", "tilesetId": "modern_city", "layout": "building",
    "spaceProfile": "open", "purpose": "주차·회전 차로는 비워야 한다",
    "requirements": [{
      "id": "floor", "role": "floor", "what": "현대 콘크리트 바닥", "available": false,
      "catalog": {"path": "실제 공용 재료 JSON", "pointer": "/floors/concrete", "sha256": "파일 해시"},
      "preview": {"path": "실제 칩 그림.png", "sha256": "파일 해시"},
      "references": [{"path": "해당 용도 참고문서", "sha256": "파일 해시"}],
      "bindings": [{"tool": "build_hand_interior_room", "field": "floor", "id": "concrete"}]
    }]
  }]
}
```
role: floor/wall/ceiling/prop/event-graphic/terrain. 실내는 floor/wall/ceiling을 모두 포함한다.
필수 재료를 optional로 바꾸지 않는다. available=true는 catalog JSON pointer와 preview, references의 실제 SHA-256 근거가 모두 있을 때만.
미준비 재료에는 거짓 경로·해시를 쓰지 않는다. 각 변형은 한 시대의 공용 칩셋을 사용한다. 다른 시대 구조 차용은 폐기됐다.
spaceProfile: compact(작은 실내), open(주차장·교실·광장 등 목적 있는 열린 바닥), corridor(수로·통로).
빈 공간을 수치에 맞춰 벽으로 메우지 않는다. 목적과 실제 통행 폭을 먼저 정한다.
bindings는 사용하는 도구의 재료 선택 인자: handInterior의 floor/wall/ceiling/objects/tables/goods/lines/daises,
stamp_object의 objectId, fill_region의 material. 직접 타일 번호는 paint_tiles/tile의 id에 숫자를 문자열로 넣는다.

`gaps.json`: 미준비 재료마다 kind(art/event-graphic/tileset/tool), what, route,
item(id/ko/w/h/category/desc/why/worldviewId)을 쓴다. 현재 하네스의 지원 범위를 먼저 읽고 배정한다.
조선은 joseon-baram, 현대는 modern-chipset, 일본은 jp-city, 중세 실내는 interior-props.
지원하지 않는 종류는 그 하네스의 확장 필요 사항까지 적는다. 도구/구조 마감도 그림 한 장으로 해결했다고 하지 않는다.
결과는 위 두 파일만. 기존 card.json과 examples는 과거 초안으로 보존한다.


## 다른 하네스와의 제작 연결

에디터와 같은 정본 목록 `{{ROOT}}/src/harnesses/catalog.json`을 읽는다.
산출물 종류와 시대·장르에 맞는 항목을 찾은 다음 그 항목의 doc/seed/진입 경로를 확인한다.
하네스 id를 기억이나 임의 목록으로 지어내지 않는다. 목록이 없으면 그 사실을 기록하고
정본 registry.ts와 해당 manifest를 확인한다. CLI/editorUi 존재는 감독 실행 어댑터 지원을 뜻하지 않는다.
monster-collect-species는 monster-collect 게임 전용이며 일반 생물/적 캐릭터 제작에 배정하지 않는다.
캐릭터·월드맵·타일·장면은 서로 다른 산출물이다. 다른 종류의 검사 합격으로 대신하지 않는다.
다른 하네스가 이미 공용으로 등록한 현재 승인 결과가 있으면 새 제작 전에 재사용 가능성을 조사한다.
기존 선택 원본·공용 판본·참고문서와 실제 그림을 확인한다. 사용자의 결정이나 native 판정을 대신 쓰지 않는다.
부족한 연결은 어느 단계(실행/결과 수집/사용자 결정/공용 등록/프로젝트 설치)인지 기록한다.
통합 설계: `{{ROOT}}/docs/superpowers/specs/2026-10-05-unified-harness-production.md`.
