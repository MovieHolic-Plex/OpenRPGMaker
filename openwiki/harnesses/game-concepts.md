# game-concepts — 새 게임 피드의 공식 컨셉 카드

새 게임 피드(`src/start/conceptFeed/`)에 올라가는 공식 컨셉을 만든다. 컨셉 한 장 = 제목·훅·설명·분류·장르 틀·주인공·무대·첫 장면·기획 5칸·도트 썸네일(`src/concepts/format.ts`, `oprn-concept/1`).
설계는 `docs/superpowers/specs/2026-10-07-concept-feed-design.md`.

## 규칙

- **사람이 받은 것만 게시한다.** 감독 에이전트는 고르기 화면을 대신 누르지 않는다.
- 판정은 그 순간의 큰 그림 sha256 에 묶인다. 그림을 다시 그리면 판정이 풀리고 다시 골라야 한다.
- 원작 이름은 쓰지 않는다(`CONCEPT_FORBIDDEN_NAMES`). 패러디 이름은 `CONCEPT_PARODY_NAMES` 에 명시해야 통과한다(예: 파이널 판타지아).
- 썸네일 화풍은 SNES 16비트 도트(`conceptArtPrompt`). 사용자가 애니 일러스트와 비교해 도트를 골랐다(2026-10-07).
- 운영 스토어 게시는 `--target prod --yes-prod` 둘 다 있어야 한다.

## 단계

```bash
npm run harness -- game-concepts produce [--tag 웹소설] [--count N] [--parallel 5]   # claude -p 로 컨셉 JSON
npm run harness -- game-concepts draw [--parallel 4] [--slug S] [--force]            # 도트 썸네일 960×540 / 480×270 webp
npm run harness -- game-concepts check [--redraw] [--force]                          # 금지 이름 + 그림 비전 판정(참고용 경고)
npm run harness -- game-concepts serve [--port 18321]                                # 받기/버리기 화면 http://mdc-server:18321/
npm run harness -- game-concepts status                                              # 분류별 후보·그림·경고·받음·버림·대기
npm run harness -- game-concepts publish [--target staging|prod|http://…]            # 라인업만 스토어에 (운영은 --yes-prod)
npm run harness -- game-concepts bundle [--size N]                                   # 라인업을 앱 번들 public/assets/concepts + src/assets/bundledConcepts.json
```

| 단계 | 쓰는 것 | 메모 |
|---|---|---|
| produce | `claude -p --model sonnet`(`GC_WRITER_MODEL`) | 시드 `targets` 의 분류별 목표에서 부족한 만큼 12개씩. 같은 제목·형식 오류·원작 이름은 `logs/produce.log` 에 사유를 남기고 버린다. slug 는 영어 번역 제목에서 만든다 |
| draw | 앱 그림 경로 `http://mdc-server:9888/v1/images/generations`(`GC_IMAGE_ENDPOINT`), 제공자 `openai-codex` | 한 장 40~60초. 9888 이 떠 있어야 한다. 실패는 `logs/draw.log` |
| check | `claude -p --allowedTools Read` 비전 판정 | 결과는 `checks/<slug>.json`(그림 해시 포함). 화면에 노란 경고로만 보인다 — 결정은 사람 |
| publish | 라인업만. `POST /api/v1/blobs` → `POST /api/v1/admin/concepts` | 토큰 `OPRN_STORE_TOKEN` 또는 `~/.config/oprn-store/cli.json`(storeCli 로그인). 운영자여야 한다. rank 는 분류 순환으로 매겨 첫 쪽이 다양하다 |
| bundle | 라인업 전부(분류 순환 순서) | 커밋 대상(그림 쌍 + JSON) |

## 라인업 — 지금 칩셋으로 지을 수 있는 것만 내보낸다

2026-10-08 사용자 결정: 칩셋이 아직 많이 준비되지 않았으므로 피드는 **지을 수 있는 컨셉 20개 정도만** 보인다.
받기(18321)는 330개 전부 했지만, 내보내는 것은 시드 `lineup`(slug 목록)뿐이다.

- **지을 수 있다** = `src/concepts/format.ts` `isBuildableConcept` — `tilesetHint` 가 `BUILDABLE_CONCEPT_TILESETS`
  (`joseon_baram`·`wizarding_world`·`jp_city`·`beodeul_city`) 중 하나이고, 장르 틀이 `UNBUILDABLE_CONCEPT_PRESETS`(`monster-collect` —
  첫 구간 도로 `author_wild_route` 가 버들항 전용)가 아닐 것. 시드 `tilesetHints` 값과 이 목록은 같아야 한다(`test/conceptSource.test.ts`).
- `lineupCandidates()`(`node/data.ts`) = lineup ∩ 받음(현재 그림 해시) ∩ 지을 수 있음. 빠진 항목은 까닭을 경고로 찍는다. lineup 이 없으면 받은 것 중 지을 수 있는 것 전부.
- 앱도 같은 판정으로 거른다 — 번들·스토어 쪽·비슷한 컨셉에서 못 짓는 것을 숨기고, 분류 칩은 번들에 실제로 있는 분류만 낸다(`ConceptSource.tags`).
  「내가 쓴 컨셉」 초안도 네 무대 중 하나·몬스터 수집 아닌 장르 틀만 고르게 하고, 어기면 다시 묻는다(`src/concepts/draft.ts`).
- 첫 라인업(20): 조선 6 · 일본 도시 5 · 마법 학교 5 · 버들항 4. 모두 그림 검사 통과, 비슷한 변주(마법사 in 조선·편의점 계열)는 하나씩만. 분류 12개(몬스터 수집·SF 없음).
- **칩셋이 준비되면**: `BUILDABLE_CONCEPT_TILESETS`·시드 `tilesetHints` 에 더하고, 그 무대 컨셉 slug 를 `lineup` 에 넣은 뒤 `bundle`·`publish`.

## 데이터 폴더

`GC_HARNESS_DATA`(기본 `~/oprn-harness-data/game-concepts`) — 저장소 밖이다.

```
candidates/<slug>.json      후보 컨셉(thumb 은 로컬 파일 이름)
images/<slug>.full.webp     960×540
images/<slug>.card.webp     480×270
checks/<slug>.json          { imageSha, ok, findings, at }
decisions.json              { slug: { verdict: accept|reject, imageSha, at } } — 사람만 쓴다
published.json              { 스토어주소: { slug: 게시한 그림 sha } }
logs/*.log
```

## 시드

`harness-data/game-concepts/seed.json`: 분류별 목표 수(합 약 350), 예시 제목, 장르 틀 안내, 타일셋 힌트, 쓰기 규칙. 새 분류를 늘리려면 `src/concepts/format.ts` 의 `CONCEPT_TAGS` 에 먼저 더한다.
