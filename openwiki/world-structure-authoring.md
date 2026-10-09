> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# World 다리·다층 산 공통 저작 도구

## 정본과 진입점

- 조립 규칙: `src/project/defaults/worldStructureRules.ts`.
- 설명: `worldTileDescriptions.ts`가 같은 규칙 파일의 다리 설명을 소비한다.
- 실행: `src/editor/tools/worldStructureTools.ts`, `toolRegistry.ts`에 등록.
- `find_tools`에서 `author_world_bridge`, `author_world_mountain` 또는
  `다리`, `다층 산`, `절벽`으로 검색한다. `get_world_structure_rules`는
  정확한 타일 번호와 지원 범위를 반환한다.
- 기존 조수/툴 실행 경로를 사용한다. 별도의 마우스 드래그 브러시나 전용 패널을
  추가한 것은 아니다. 일반 `previewTool`/`applyToolToStore`의 미리보기,
  프로젝트 단위 undo/redo, 편집 감사 로그를 그대로 탄다.

## 다리

```json
{
  "mapId": "world",
  "x": 45,
  "y": 8,
  "length": 7,
  "orientation": "vertical",
  "style": "span"
}
```

위 인자로 `author_world_bridge`를 호출한다. `(x,y)`는 첫 보행 타일이다.

- `vertical + span`: 472를 남북으로 반복한다. 412·442를 양끝에 붙이지 않는다.
- `horizontal + span`: 443 보행면 바로 아래에 473 지지부를 붙여 두 행으로 반복한다.
- `horizontal + short-a/short-b`: 길이 1만 허용하며 각각 412/442를 쓴다.
- 보행면과 지지부 전체가 물이어야 하고, 앞뒤 한 칸은 통행 방향이 맞는 육지여야 한다.
- 물·육지를 자동 생성하거나 양안을 깎지 않는다. 기존 타일과 이벤트가 있으면 거부한다.
- 모서리·T자·십자·다리 아래 통행은 지원하지 않는다. 조립할 원본 아트와 고도 계약이
  없는 기능을 직선 타일 조합으로 성공 처리하지 않는다.

## 다층 산

```json
{
  "mapId": "world",
  "surface": "snow",
  "tiers": [
    {"x": 8, "y": 5, "width": 27, "height": 26, "stairX": 12},
    {"x": 12, "y": 8, "width": 18, "height": 16, "stairX": 26},
    {"x": 16, "y": 11, "width": 9, "height": 7, "stairX": 19}
  ]
}
```

위 인자로 `author_world_mountain`을 호출한다.

- `surface`: `grass`, `dirt`, `snow`. 상판 앵커는 78, 81, 168.
- `tiers`: 아래층부터 위층 순서, 1~4단. 좌표는 맵 절대 좌표다.
- 각 상판은 최소 7×5칸. 상판 아래에 **벽 2행**을 더 만든다.
- `stairX`는 해당 상판 내부 열이다. 남쪽 가장자리·벽 2행을 374 계단으로 연결한다.
  계단 바로 아래 한 칸도 맵 내부여야 한다.
- `frontOffsets`: 선택. 길이 `width`의 정수 배열로 각 열의 남쪽 끝을 -2~2칸 이동한다.
  이웃 값의 차이는 최대 1칸이다. 돌출 전면·비대칭 산체를 만들 때 쓴다.
- 위층 상판·벽·계단 아래 진입부 전체가 아래층의 **경계가 아닌 내부 평면**에
  들어가야 한다. 계단을 지우거나 층끼리 우회 연결되는 도면은 거부한다.
- 정상까지 실제 `canMove` 경로를 찾고, 각 층 계단을 한 번씩 막아 우회 진입이
  없는지 검사한다. 열린 내부 평면에만 석재 길을 넣고 계단/테두리는 보존한다.
- 결과 `data`에 `entry`, `summit`, `gates`, `route`, `tiers`, `tilesetId`가 있다.
- 기존 산·벽·물이나 상위 물건을 덮지 않는다. 평평한 빈 보행 지면을 지정한다.
- 설원 검증 캔버스의 평평한 바탕은 비오토타일 샘플 247이다. 190과 원본 픽셀은
  같지만 전체 캔버스 테두리/암벽 주변에 눈 오토타일의 잔디 경계를 만들지 않는다.

## 다른 맵과 사용자 설정 보호

원본 World 칩셋(16px, 30열)만 지원한다. 같은 번호의 다른 칩셋이나 이식한 타일은
거부한다. 조립에 쓰이는 타일을 사용자가 오토타일 그룹에 넣은 경우도 거부한다.
원본 투명키 `#ff678b`도 전용 타일셋에 기록한다. 다른 사용자 투명색이 지정돼 있으면
덮어쓰지 않고 거부한다. 화면 검사는 실제 캔버스의 분홍 투명키 잔존이 0픽셀이어야 통과한다.

대상 맵은 `world_structures_<mapId>` 전용 타일셋을 사용한다. 같은 원본 타일셋을
쓰는 다른 맵의 통행은 바뀌지 않는다. 이미 쓰는 전용 ID나 공유된 전용 타일셋은
덮어쓰지 않는다. 이 때문에 undo는 맵만이 아니라 **프로젝트 스냅샷**이어야 한다.

사용자 잠금의 통행·우선순위가 필요한 규칙과 다르면 거부한다. 실제 배치의
교량 그림은 `upperTiles`지만 캐릭터 아래에 그려야 한다. 현재 하네스가
`tileMeta.defaultLayer`를 렌더 우선순위로 재적용하므로 이 override는 `lower`로
저장하고 `priority:lower`를 유지한다. 로드 후 `ensureBundledTilesets`까지 테스트한다.

공통 다리 설명 이행은 정확히 알려진 옛 번들 문구만 바꾼다. 사용자 문구·잠금·이식된
타일 설명은 보존하며, 이미 배치된 타일 번호나 기존 통행은 설명 이행으로 바꾸지 않는다.

## 검증

- `npm test -- test/worldStructureTools.test.ts test/toolSchemaProviderCompat.test.ts`
- `bun scripts/verify-world-structure-tools.mts`
  - 별도 LegacyDb `rpg-zzu-world-structure-tools-20260906`에 초원/흙/눈 검증 맵을 저장한다.
  - 3개 맵에서 도구 9회 실행 → 직렬화 정규화 → 저장 → 맵·타일셋 전체 재로드 일치.
  - 원격 행이 이미 있으면 로컬 receipt와 일치해야 한다.
  - `--recover-saved`는 저장 후 로컬 receipt 작성 전에 중단된 경우만 쓴다.
    생성한 맵·타일셋과 원격 전체 일치 후 읽기 전용으로 receipt를 복구한다.
- `node scripts/qa-world-structure-tools.mjs`
  - 10147의 격리 편집기에서 도구 미리보기/적용/undo/redo를 검증한다.
  - 원격 재로드본 3개를 엔진 렌더러로 캡처한다.
  - 별도 출하 플레이어에서 세 층을 실제로 걸어 정상까지 간다.
- 산출물: `reports/world-structure-tools/`, 런타임 요약은
  `verify-shots/runtime-qa/world-structure-tools/SUMMARY.md`를 먼저 읽는다.
