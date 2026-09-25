# 실제 조수의 학교·교실·실내·도시 구현 확인 — 2026-09-25

계단 한 사례의 성공을 다른 장면까지 일반화하지 않고 별도로 확인했다.
사용한 자료와 실행 경로는 [AI-SCENE-AUTHORING](AI-SCENE-AUTHORING.md)에 있다.

## 공용 등록과 도구

- 380개 다운로드 원본 범위 유지. 추가 원본 다운로드/그림 배포 없음.
- 공용74장소: 기존46 + 저장된 학교에서 추출한28실(교실16/특별관리실8/화장실4).
- `list_shared_scenes` → `inspect_shared_scene` → 소유 문서/그림 → `build_shared_scene` → 결과 그림.
- 74개 전체의 결정론 재현:88맵,49,606레이어 칸 일치, 학교 방 접근242곳 도달.
- production runner6사례(도시/학교/교실/과학실/주택/체육관) 통과.
- 기존 정본의 공간 계층을 유지한 교실 생성 dry-run 통과.
- 새 프로젝트/기존 프로젝트 모두 학교 방28킷과 공용 실행 지침 조회 가능. 기존 맵 불변, 재투영 멱등.
- 현재 메인 라이브러리 revision: `fcf8ef427e2ea8482ee20e79d5abcbe4a2678d0192c86a23fae71b4483700aac`.
- 공용 전체 revision: `0755c68fa08567da6898666654ef30dd15a16c97148b41a5aa331840f33b3e15`.
  실제 모델 실행 후 공통 문서만 추가했으며 맵 배열은 불변이다.

## 실제 모델 실행

앱의 `runPiAgent`, 실제 `find_tools`/레지스트리/commit 경로, 연결된
`google-antigravity / gemini-3.7-flash`를 사용했다. 초기 노출 도구는 find_tools와
참고문서 조회뿐이며 모델이 구현 도구를 발견했다. 정답 배열이나 응답 모킹은 사용하지 않았다.

| 요청 | 실제 조수가 생성한 맵 |
|---|---:|
| 도시50×50 + 연결된 시설·학교 | 12 |
| 독립 학교4층 전체 | 4 |
| 사물함 교실 | 1 |
| 과학실 | 1 |
| 거실·침실·주방이 구획된 주택 | 1 |
| 체육관 | 1 |
| 이자카야 | 1 |
| 합계 | 21 |

처음 실행:19턴/51도구 호출. 7번의 build_shared_scene은 성공했고 배열은 모두 일치했다.
하지만 확인용 renderToolImage 콜백의 인자 순서를 잘못 연결해 이미지 전달4건이 실패했다.
이 실행을 전체 통과로 보고하지 않았다.

콜백을 수정한 뒤 같은 모델 출력 프로젝트를 이어받아 검토했다.4턴/9도구 호출/도구오류0.
생성 때 원본 이미지6개를 읽었고, 검토 때7묶음의 결과 이미지7개가 실제 모델에 전달됐다.
학교 전체 문서에는 자체 그림이 없고 층별 문서가 그림을 소유한다.
모델이 재작성한 것이 아니라 **이미 생성한21맵이 그대로** 검토를 통과했다.

관측기의 기존 맵 비교도 처음에는 JSON 문자열의 프로퍼티 순서를 비교해 false를 냈다.
JSON 값의 깊은 비교로 고친 뒤 기존 빈 맵 불변을 확인했다. 결과 프로젝트는 수정하지 않았다.
원본 관측 보고서와 수정 전 비교 보고서도 private output에 보존했다.

이 관측은 기존에 저작한 예제의 정확한 재현/후속 편집 경로를 확인한다.
임의 크기·새 평면을 처음부터 설계하는 능력이나74장소 각각의 모델 성공률을 뜻하지 않는다.
NPC/판매/문 개폐 등 원본에 없는 동작을 구현했다고 주장하지 않는다.

## 저장과 재로드

조수 출력은 기존 빈 맵1개 + 새21맵 =22맵인 별도 SQLite 프로젝트에 저장하고 닫은 뒤 다시 열었다.

- project id: `21e9b91e-8823-4e88-be39-fee59a8c6965`
- 저장 대상: `/home/main/.local/share/oprn/paw-scenes-ai-check-20260925/project.sqlite`
- revision1, SHA `f85a9f4dbe2b3730ceb4f91d22e784e2b801018e8d940ad3ad018e5a05e292be`
- 전체 프로젝트 JSON 값과 저장된 그림 bytes 재로드 일치(고유 그림10개).

사용자 원래 프로젝트의 공용 학교 자료도 공식 호스트 API로 갱신했다.
project id `6ae74f7a-23a2-449b-8171-5afb5dff532b`,
`/home/main/.local/share/oprn/paw-city-20260924/project.sqlite`, revision76,
SHA `33c1700d34de7ab98df8188efd3e6e664e2ddaf978830272b91fbbc3b0ec82ce`.
재로드 일치, 기존12맵과 공간 계층 불변. 서버에는 새 도구를 포함한 앱 빌드를 반영했다.

## 재현 명령과 증거

- `bun scripts/qa/pixel-art-world-scenes.mts <output>`: 실제 설치 카탈로그 전체 결정론 검증.
- `bun scripts/qa/pixel-art-world-scenes-live.mts <output> [이전-output]`: 실제 연결 모델 호출(쿼터 사용).
- `node scripts/content/save-scene-ai-observation.mjs <result-project.json> <새 SQLite 폴더> <output>`: 저장·재오픈.
- private evidence: `output/paw-all-authoring/coverage-final/report.json`, `projection-proof.json`,
  `existing-project.json`, `live/report.json`, `live-reviewed/report.json`, `saved/storage-proof.json`,
  `shared/guide-proof.json`, `shared-save/proof.json`.
- 앱 build: 성공. 저장소 규칙상 전체 gates/vitest/typecheck는 실행하지 않았다.

## 실제 플레이어 연결 검사

조수가 만든 사본의 전이32건(도시 묶음26 + 독립 학교6)을 전용 `player.html`에서
실제 action/touch 입력으로 실행했다. 목적 mapId/좌표 모두 일치, 브라우저 오류0.
편집기 play 셸을 사용하지 않았다. 문서/킷 메타데이터만 플레이어 입력에서 제외했고
맵·이벤트·통행·그림 bytes는 조수 출력 그대로다.

첫 두 브라우저 부팅은 타이틀이 나타나지 않아 실패로 보존했다. 두 번째에는
`net::ERR_NETWORK_CHANGED`로 모듈 요청 실패가 관측됐다. 전용 캐시와 제한된
부팅 재시도를 적용한 마지막 실행에서32/32를 확인했다.
증거: `output/paw-all-authoring/runtime-final/SUMMARY.md`, `report.json`, `player.png`.

재현: `bun scripts/qa/pixel-art-world-scenes-plan.mts <result-project.json> <plan.json>` 다음
`VITE_CACHE_DIR=<독립 캐시> node scripts/qa/pixel-art-world-scenes-runtime.mjs <result-project.json> <plan.json> <output>`.
통과는 전이 입력 실행의 증거이며 모든 타일의 미적 승인/모든 가구 상호작용 확인이 아니다.
