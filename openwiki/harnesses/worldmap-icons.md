# 월드맵 아이콘 하네스

구조·시점 계약·사용자가 허용한 예외: `src/harnesses/worldmap-icons/README.md`.
선택 정본은 저장소 밖 `WMI_HARNESS_DATA/harness.sqlite`다. 선택을 대신 기록하지 않는다.

## 입구

```bash
npm run harness -- worldmap-icons status
npm run harness -- worldmap-icons serve --port 18313
npm run harness -- worldmap-icons draw '<세트/이름>' --note '교정 지시' -n 3
npm run harness -- worldmap-icons export
npm run harness -- worldmap-icons build
npm run harness -- worldmap-icons check
npm run harness -- worldmap-icons publish-shared --icons-only
```

`harness.ts`는 가벼운 공통 등록, `node/cli.ts`는 기존 Python 입구를 호출한다.
`build/check`는 `bake.py`다. 별도 선택 화면은 있지만 에디터 공방 실행기는 없으므로 `editorUi:false`다.

## 호스트 공용 DB 등록 (2026-10-04)

공용 번들과 호스트 `shared-content.sqlite`는 별개다. `publish-shared`는 먼저 현재 사람 선택·시트·해시를
`bake.py check`로 대조한 뒤 로컬 등록 API의 CAS로 자기 라이브러리만 쓰고 같은 판본을 다시 읽는다.
LegacyDb/원격에는 쓰지 않는다. `--dry`는 준비·그림 대조만 한다.

- `--icons-only`: `worldmap-human-selected`의 `shared_worldmap_selected`에 선택 79개와 3용도 참고문서를 등록한다.
  `projectDefaults:true`이므로 새·기존 프로젝트의 공용 기본 자료에 들어간다. 미선택 후보는 등록하지 않는다.
- 지형 사례까지 등록: `publish-shared --joseon <정본 프로젝트 폴더> --yucatan <정본 프로젝트 폴더>`.
  두 정본에서 `world_map`을 다시 읽고, 공용 사본 렌더가 원본과 픽셀 단위로 같은지 확인한다.
  `worldmap-real-joseon`/`worldmap-real-yucatan`은 `projectDefaults:false`인 완성 지역 사례다.
  두 큰 지도 그림은 부팅 기본 자료로 복제하지 않고 요청 시 가져온다.
- 지도 사본의 실제 지형 설정·캐릭터 크기·장소 좌표와 필요한 업로드 그림을 함께 보존한다.
  새 맵은 `worldmap_<새 mapId>` 전용 타일셋을 소유하여 공용 원본·다른 사본과 편집을 공유하지 않는다.
  전이 이벤트는 원본 스냅샷에 보존하며 새 맵으로 가져올 때 기본값은 제외다.
- 근거: `verify-shots/worldmap-shared-db/publication.json`, `contract.json`, 실제 조수 호출의 `assistant-*/summary.json`.

## 사람 선택만 굽기

- 현재 원본 SHA1과 일치하는 마지막 결정 중 `client=web`의 `accept/pick`만 쓴다.
- 받기·후보 선택·일괄 받기는 화면에서 읽은 원본 SHA1을 먼저 대조한다. 바뀐 그림을 옛 화면에서 선택하면 거부한다.
- pick은 자기 아이콘의 완료된 판·시도만 허용한다. 새 결정은 그림 SHA256·후보 시도 번호를 함께 기록한다.
  기존 결정은 첫 굽기의 `slots.json.selections`에 그림 SHA256을 고정한다. 그림이 바뀌면 새 선택 없이 굽지 못한다.
- 원본 사본·현재 선택 사전은 `tiledata/worldmap-kit/selected/`, 칸 위치·해시 고정은 `harness-data/worldmap-icons/slots.json`.
- 재작성 검수에도 판의 교정 지시를 전달한다. 명시적으로 바꾼 색·소품은 옛 설명보다 우선하되 시점·지도 1배 식별 검사는 유지한다.
- 칸은 덧붙이기 전용이다. 미선택으로 돌아간 옛 칸은 비워 두고 번호를 다른 아이콘에 재사용하지 않는다.
- `--snapshot`은 커밋한 사람 선택·PNG 사본으로 재현한다. SQLite에 쓰지 않는다.
- 결과: `public/assets/worldmap-icons/worldmap-selected.png`, `src/assets/worldmapSelectedSheet.json`, `worldmapSelectedReferences.json`.
  참고 그림은 `public/assets/worldmap-icons-references/`; 번들 JSON에는 이미지 바이트를 넣지 않는다.
- RGBA: 분홍 키는 투명, 그림자 키는 검정 alpha80. 기존 EasyRPG 지형 0~479를 그대로 앞에 두고 선택 아이콘만 뒤에 붙인다.

## 에디터·조수

`worldmap_selected`는 모든 새 프로젝트와 기존 프로젝트에 배선된다. 16px·30열.
선택 그림별 위층 그룹과 사람 팔레트 스탬프가 있으며, 조수는 `list_worldmap_icons → 참고문서 읽기 → stamp_worldmap_icon → inspect_worldmap_icon`을 쓴다.
생성 지도에는 타일 이식으로 덧붙인다. 맵 id·원래 바닥은 보존한다. 입구와 접근 칸을 돌려주지만 전이 이벤트는 별도다.
★ 윗줄은 바닥 통행을 따른다. 밑줄 중앙은 통행, 나머지는 막힘이다. 막힌 육지 받침·접근 칸·위층 겹침·맵 밖은 수정 전에 거부한다.
`inspect_worldmap_icon`은 정답 전체 배열과 이식 소스 번호를 대조해 MISSING_CELL/WRONG_CELL 및 실제 맵 좌표를 돌려준다. 다른 위층 덮개로 가려진 칸도 OCCUPIED_OVERLAY로 보고한다.

## 2026-10-04 근거

79개(원본72·선택후보7), 1,620칸. `verify-shots/worldmap-selected/`에 새·기존 SQLite 저장·재로드, 칸 누락 검출,
위층 충돌 거부, 바닥 보존·36칸 이식 재사용, 캐릭터 크기 UI 저장·브라우저 재로드 근거를 남긴다.
미선택267개는 공용 선택 시트에 들어가지 않는다. 스팀펑크 교정 판 r61~65는 사람 선택 대기다.
