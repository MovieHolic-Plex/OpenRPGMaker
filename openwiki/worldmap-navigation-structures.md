# 세계 지도 이동 구조 6종 (2026-10-05)

[게임 조사](worldmap-game-research.md)의 여섯 이동 방식을 실제 맵·이벤트·플레이어 지도창으로 구현했다.
세계관 `theme`은 지형/그림의 선택이고 `structure`는 이동 방식의 선택이다.
현재 저작 레시피는 기존 공용 숲마을·던전 타일과 판타지 대륙을 사용한다.

## 지원 범위

| structure | 실제 맵 | 이동과 진행 |
|---|---:|---|
| `region-routes` | 8 | 마을/도로 전도, 실제 문으로 왕복, 물길 통행증 |
| `scaled-world` | 9 | 캐릭터 50% 대륙 직접 걷기, 8개 거점 출입, 성문 열쇠 |
| `field-overview` | 9 | 실제 타일 지형을 조합한 전도, 필드 문, 두 열쇠 관문 |
| `stage-nodes` | 8 | 코스 관문 클리어, 열린 인접 코스 선택, 별도 비밀 출구 |
| `room-network` | 10 | 횡스크롤 방, 발견한 방만 표시, 능력 관문, 재탐색과 핀 |
| `run-path` | 13 | 위층 일방향 분기, 전투/정예/보스·선택 사건·보물·상점·휴식 |

게임 이름은 조사 비교 대상이다. 상용 게임의 그림·몬스터·전투·액션을 복제한 결과가 아니다.
포켓몬식 포획/체육관, 마리오의 플랫폼 코스, 할로우 나이트 전투, 스파이어의 카드 전투는
이 이동 구조 기능에 포함되지 않는다. 횡스크롤 방은 기존 sideView 엔진을 쓴다.
런 전투는 프로젝트에 있는 기본 전투/적 부대, 보상·상점·휴식은 기존 명령을 쓴다.
연결 그래프는 유형별 레시피이며 seed는 실제 필드 배치를 바꾼다. 매번 새 그래프를 만드는 생성기는 아니다.
축척 대륙에는 키트의 기존 31개 랜드마크 그림이 있고, 그중 처음부터 걸어 닿는 8개에 별도 맵을 연결한다.

## 편집기와 조수

「새 맵 → 세계 지도 만들기」에서 방식·이름·배치 번호를 고른다.
`worldAtlasCreateDialog.ts`는 준비 후 같은 `applyToolToStore` 트랜잭션으로 추가하고 새 맵을 선택한다.
기존 시작 맵/좌표는 유지한다. 중복 id는 거부하며 기존 맵을 덮어쓰지 않는다.

- `list_worldmap_structures`: 여섯 방식과 정본 PNG·맵 수·원본 project id.
- `read_worldmap_structure_reference({structure})`: 실행 지침, 전체 장소/연결 정의, PNG.
- `author_worldmap_structure({id,structure,seed?,name?,setStart?})`: 실제 맵·문·관문·스위치를 함께 추가.
  `structure:"all"`은 6종 57맵. `setStart` 기본 false, true이면 첫 생성 묶음의 시작으로 바꾼다.
- `inspect_worldmap_structure({id?})`: 실제 맵/스위치/통행, 문 좌표/이동 명령/착지, 겹친 문,
  관문 도달성과 자기 열쇠 뒤 잠긴 순환을 검사한다.

월드맵/세계 지도 요청은 위 도구를 초기 조수 목록에 노출한다(`sessionToolExposure.ts`).
참고문서 읽기는 Pi/기존 조수 양쪽에서 정본 PNG를 실제 image part로 첨부한다.
Pi의 일반 응답 상한으로 전체 연결 정의가 잘리지 않도록 이 읽기에 32,000자 예산을 쓴다.
실제 타일 수정 시에는 해당 타일셋의 `list_tileset_references`/`read_tileset_reference`를 계속 먼저 읽는다.
저작기는 기존 `author_village`·숲 도로 도구와 layer mutation helper를 사용한다.
이 과정에서 발견한 마을 범위 검사의 폴더 metadata 누락은 `authorVillageScope.stripAddedNodes`에서
`{...node, children}`으로 보존한다. 맵 트리를 바꾸지 않은 마을도 폴더 이름/종류가 있으면 거부되던 문제다.

## 플레이어

세계 지도 버튼 또는 **M**으로 열고 M/Esc로 닫는다. 묶음에 속하지 않는 맵은 기존 M 미니맵을 사용한다.
지도창은 확대된 논리 대화 레이어가 아닌 `.play-viewport`에 붙는다. 열려 있는 동안 이동·시간을 멈춘다.

마을·필드·방은 지도에서 순간이동하지 않는다. 필드의 실제 playerTouch 문을 밟는다.
축척 월드는 거점 입구를 밟아 들어가고 귀환 시 입구를 다시 밟지 않는 옆칸에 착지한다.
스테이지/런은 지도 버튼에서 현재 위치의 열린 인접 장소를 고른다. 클릭 시 현재 맵과 스위치를 다시 읽고,
엔진 transfer 진입에서도 조건을 확인한다. 런은 이전 층과 이미 방문한 분기로 돌아가지 않는다.
일반 코스 클리어와 비밀 출구는 서로 다른 스위치다.

핀·발견·클리어·능력은 기존 `session.switches`다. 정상 세이브 슬롯이 함께 저장한다.
지도 열기 자체는 관문을 클리어하지 않는다. 실제 관문 이벤트가 보상을 주고 조건을 연다.
전투 관문은 승리 분기에서만 클리어하며 패배/도주에서는 닫힌 상태로 남는다.

## 데이터와 소유 파일

`Project.worldAtlases?: WorldAtlas[]`는 선택 필드다. 기존 프로젝트에는 없어도 된다.
`io/shape.ts`는 구조/노드/연결/범위/id를 정규화하고 잘못된 외부 정의를 거부한다.
저장 문서가 이 필드를 보존한다. 별도 세이브 형식이나 버전 수동 변경은 없다.
맵 삭제는 노드·연결·핀을 함께 정리하고, 대륙 삭제 또는 2개 미만 노드는 묶음을 제거한다.

| 파일 | 역할 |
|---|---|
| `src/project/worldAtlas.ts` | 자료형·카탈로그·진행/이동 판정·정규화; 브라우저/호스트 공용 가벼운 모듈 |
| `src/project/worldAtlasAudit.ts` | 실제 타일 통행/명령과 그래프의 일치 검사 |
| `src/project/worldAtlasRender.ts` | 런타임과 PNG의 같은 SVG 렌더러 |
| `src/editor/worldmap/atlasAuthoring.ts` | 실제 레시피·맵·문·보상 저작 |
| `src/editor/tools/worldAtlasTools.ts` | 조수 조회·저작·검사 |
| `src/player/worldAtlasOverlay.ts` | 발견/핀/이동 버튼·입력/정지·실제 맵 그림 |
| `src/editor/panels/worldAtlasCreateDialog.ts` | 편집기 생성 창 |

## 공용 배포

출처 `tiledata/worldmap-structures/`의 6개 MD/JSON은 전체 연결과 좌표·정상/오류 계약을 담는다.
`src/assets/worldAtlasExamples.json`은 모든 프로젝트에서 조회하는 공용 참고문서 번들이고
PNG는 `public/assets/worldmap-structures/` 경로를 사용한다. 번들 JSON에 이미지 바이트를 넣지 않는다.
`SharedContentLibrary.worldmapStructures`는 같은 참고문서/저작 인자/정본 표본을 호스트 공용 DB에 보관한다.
공용 pack은 `worldmap-navigation-structures-v1`, projectDefaults=false이며 조회 자료다.
다른 프로젝트의 맵을 자동으로 추가하지 않는다. 저작 도구가 새 id로 실제 맵을 만든다.

```sh
bun scripts/content/author-worldmap-structures.mts --phase create
bun scripts/content/author-worldmap-structures.mts --phase images
bun scripts/content/prepare-worldmap-structure-references.mts verify-shots/worldmap-structures --publish
```

create는 기존 project.sqlite가 있으면 덮지 않는다. images와 자료 재생성은 정본을 다시 읽는다.
`--publish`는 `/home/main/.local/share/oprn/shared-content.sqlite`의 로컬 publication API만 사용한다.
원격 LegacyDb/Supabase에 쓰지 않는다. 현재 revision/재로드 근거는
`verify-shots/worldmap-structures/shared-library.json`.

## 정본과 화면 근거

저장 루트: `/home/main/.local/share/oprn/worldmap-structures-20261005/`.
각 폴더의 project.sqlite에 저장한 뒤 닫고 다시 열어 연결 정의 동치와 audit.ok를 확인했다(각 revision 1).

| 폴더 | project id |
|---|---|
| region-routes | 380b537f-432e-4023-808e-a1ee990d1930 |
| scaled-world | 70c0476c-bfc0-4137-b902-f03abbf1069c |
| field-overview | 63423c08-057f-4cd9-bc1f-d15463f83d72 |
| stage-nodes | 9d4e906c-82ea-4be9-8f0d-43c13961b2c1 |
| room-network | d6b1aff2-e5bf-4e50-85b2-8014d9a2e8ec |
| run-path | 4a79cc30-5223-45b6-81d1-e8125c268e39 |

`verify-shots/worldmap-structures/canonical-projects.json`과 `summary.json`이 재로드 근거다.
같은 재로드 자료의 실제 타일 PNG와 공용 렌더러로 6개 전체 지도 PNG 및 `all-six.png`를 만들었다.
전체 PNG는 저작 검토를 위해 미발견 방도 표시한다. 런타임 방 지도는 발견만 표시한다.
전용 `player.html` 캡처는 `scripts/qa/capture-worldmap-structures.mts`,
결과는 같은 폴더의 `runtime/<structure>/SUMMARY.md`부터 읽는다.
맵을 디버그 위치로 옮기는 관문 비트는 이벤트/이동 UI 확인용이며 전체 플레이 완주 증거는 아니다.

여섯 유형 전용 플레이어 캡처의 43개 비트가 통과했고 런타임 JS 오류는 없었다.
지역·대륙·필드·방의 실제 문 이동, 스테이지/런의 관문 해금 후 선택 이동,
핀·지도 중 이동 정지·M/Esc를 확인했다. `editor-capture.json`은 생성 창의 6옵션과 실제 생성 확인이다.
`assistant-tool-handoff.json`은 6종의 전체 지침과 PNG가 Pi 응답에 실린 증거다(파일 SHA256 일치).
모델 서버 `http://100.73.251.77:8000/v1` 연결 실패로 자연어 실호출 2회는 완료되지 않았다.
`assistant-region*/events.json`에 실패가 남아 있다. 실모델의 새 구조 생성 성공으로 보고하지 않는다.
