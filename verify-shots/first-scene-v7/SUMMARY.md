# 첫 자동 게임 — 실제 출하물 검증 (2026-10-04)

**판정: 이 스토리 샘플의 자동 제작·저장·플레이 기능 통과. 연출 완성도는 개선 필요.**
게임을 손으로 고치거나 조수에게 추가 제작을 요청하지 않았다. 원래 생성은 한 번의 실제 UI 요청이다.
최초 Firefox 관측 실패는 `generation.json`에 그대로 남겼다. 서버 정상 종료 기록을 읽고
Chromium에서 같은 SQLite 저장본을 재로드한 결과는 `reloaded.json`으로 분리했다.

## 실제 확인

| 단계 | 근거 | 결과 |
|---|---|---|
| 새 프로젝트 인터뷰 → AI | `actual-first-task.txt`, 요청 39,767자, 단일 실행 | 기획·주인공·두 선택 전달 |
| 자동 단계 완료 | `wire.json`, core ready → 핵심 검수 → 장소/도입 → 실제 전체 맵 이미지 검수 → root done | 129턴·159도구 호출 |
| 정본 저장·재로드 | project id `b2b88fc2-66b1-4455-9a2a-d97674cd5d1f`, revision 28 | 추가 AI POST 0, 원래 맵 해시 동일 |
| 실제 편집기 메뉴 다운로드 | `export.json`, 49.5초 | ZIP 다운로드 성공, 수동 수정 없음 |
| 정본과 ZIP 비교 | `gameplay.json` | 맵 4층·이벤트·기획·시작 위치·시스템·배우 DB·엔딩 일치 |
| 실제 출하 플레이어 | `keep/SUMMARY.md`, `release/SUMMARY.md` | 두 선택 모두 7/7, 총 14/14 |
| 화면 크기 | 1280×900 브라우저의 실제 stage 1200×900, 좌우 40px | 화면 비율 유지·높이 전체 사용 |
| 첫 구간 엔딩 | 실제 `.ending-heading` alpha ≥0.95, 엔딩 제목 표시 | 생성 직후 검은 페이드로 통과시키지 않음 |

전용 `player.html`에서 정상 motion과 방향키·Enter·숫자 선택만 사용했다.
편집기 play 모드, 디버그 순간이동, 상태 주입, JSON 패치, 오프닝 건너뛰기는 사용하지 않았다.
최신 main을 합친 뒤 앱·플레이어를 다시 빌드하고 같은 게임을 다시 다운로드·플레이했다.
이때 공용 자산/부팅 정규화로 revision 27→28이 됐고, 기존·새 ZIP에서 달라진 최상위 필드는
`meta`(terms/bootNormalization), `resourceProfiles`, `tilesets`였다. 원래 맵 해시는 같고
기획·이벤트·주인공·시스템·엔딩은 보존됐다.

- 정본 폴더: `/home/main/.codex/worktrees/0a57/rpg-zzu/output/qa/first-scene/project/.oprn-projects/c7af65e5-be5f-407a-ad23-ff85612649fd`
- 맵 SHA-256: `7486063bacd9bf7059dc4c2fa92a6c63f2c8deec9414a9bb0d9e45fcab23e847`
- 출하 ZIP: `/home/main/.codex/worktrees/0a57/rpg-zzu/output/qa/first-scene-v7-final/game-web.zip` (341,357,866 bytes, 4,164 entries)
- ZIP SHA-256: `1377093a2c9f6809abf07b148c71870030f56a0057713fea8499faedb360e106`
- 최종 SDK artifact: `b0819506aea7a543` / source `18c7199d6081a593cd1176201afe7741561bfaddc222248b336ce9b911dd88b2`
- SDK 빌드 revision: `f49e3761e7`. 이후 커밋은 QA·문서·증거만 변경한다.
- ZIP의 `player-manifest.json`은 해당 빌드 manifest와 동일하다.

## 즉시 확인할 화면

| 파일 | 확인 내용 |
|---|---|
| `opening-to-first-play.gif` | 실제 녹화의 최초 35초, 1배속, 960×675, 10fps. 타이틀 → 방 도입 → 이동 → 시계 조사 |
| `keep/01-title.png` | 전체 높이를 쓰는 실제 타이틀. 기본 문구/눈 내린 마을 배경이 남아 있음 |
| `keep/04-clock.png` | 실제 금빛 회중시계와 두 선택. 보석을 시계라고 부르던 오류 수정 |
| `keep/07-ending.png` | 페이드 완료 뒤 실제 첫 구간 엔딩 제목 |
| `release/05-response.png` | 다른 선택의 실제 다른 대사 |
| `reloaded.png` | 실제 편집기 씬까지 준비된 뒤의 SQLite 재로드 화면 |

## 남은 문제 / 다음 우선순위

1. **생성·첫 표시 지연**: 확정→첫 정본 변경 230.38초, 최종 실행 129턴·159호출.
   최초 관측은 확정 후 740초에 끊겼고 서버는 그 뒤 정상 완료했다. 빠른 첫 경험이라고 평가할 수 없다.
2. **작품에 맞는 연출**: 타이틀의 `A NEW ADVENTURE`/기본 부제·겨울 마을 배경, 비전투 장면의
   HP `514/514`, 장면 사이 미술 밀도 차이를 정리해야 한다. 빈 맵과 보이지 않는 시계는 고쳤지만
   전문적으로 연출된 첫 30초라고 판정하지 않는다.
3. **패키지 용량**: 3분 게임 ZIP이 약 341MB다. 사용 자산 중심의 내보내기가 필요하다.
4. **배치 품질 경고**: `wire.json` seq 465의 좌우 대칭 3배(기준 ≤2.2) 경고는 남아 있다.
   장면 이미지 검수 통과를 모든 미술 품질 지표 통과로 합산하지 않는다.
5. **검증 범위**: story-cutscene·Gemini 3.8 Flash의 이 샘플만 검증했다. 다른 장르/모델,
   Firefox 안정성, 소리 품질, 베타 전체 합격을 입증한 결과가 아니다.
   두 번째 플레이에서 전환 중 BGM 요청 1개가 `ERR_ABORTED`로 기록됐다. 오디오 합격을 선언하지 않는다.

## 이전 실패 보존

- `generation.json`: 최초 headless Firefox 관측 종료. 서버 정상 종료와 별개로 실패 유지.
- `qa-before-whitespace-fix/gameplay.json`: 화면 줄바꿈 때문에 원문 공백 비교가 실패한 검사 기록.
- `qa-before-ending-phase-check/`: 엔딩 DOM 존재만 검사하던 실행.
- `qa-before-main-refresh/`: 자식 엔딩 제목 페이드까지 기다리기 전 실행과 이전 SDK 다운로드.
- `../first-scene-v3/SUMMARY.md`: 보석 그림·대사 역슬래시·좌표 노출을 실제 시각 검수에서 탈락시킨 기록.
- `../first-scene-v4/SUMMARY.md`, `../first-scene-v5/SUMMARY.md`: 리소스 검색과 단계 예산 실패 기록.

빌드: `npm run build:app`, `npm run build:player` 각각 exit 0.
소스 파서·`git diff --check` 확인. AGENTS의 실행 제한에 따라 Vitest/전체 typecheck/gates는 실행하지 않았다.
