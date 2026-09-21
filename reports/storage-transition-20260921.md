# 프로젝트 저장 전환 실측 (2026-09-21)

현재 작업 파일에서 옛 공급자 명칭·연결 설정·전용 저장 코드와 경로를 제거하는 작업이다.
커뮤니티 데이터 이전은 사용자 지시로 제외했다.

## 사용자 데이터 보존 위치

- 원본 아카이브: `/home/main/.local/share/oprn/legacy-db-export-20260921/archive.sqlite`
- 원본 테이블 목록·건수: 같은 폴더의 `manifest.json`
- 새 프로젝트 폴더: `/home/main/.local/share/oprn/imported-projects-20260921/`
- 원본 id → 새 project id·폴더·저장 해시 대응: 위 폴더의 `IMPORT.json`
- 열 수 없는 원본: 위 폴더의 `unopened/` (원문과 거부 사유)

이 경로는 비공개 데이터다. 아카이브·원문·자격증명을 Git에 추가하지 않는다.

## 건수

| 테이블 | 원본 보존 행 |
|---|---:|
| user_skills | 6 |
| ai_conversations | 12393 |
| project_commits | 23660 |
| ai_activity_logs | 46134 |
| sync_verification_runs | 0 |
| tilesets | 1503 |
| projects | 189 |
| ai_analysis_runs | 15370 |
| project_changes | 19887 |
| map_edit_locks | 828 |
| terrain_templates | 0 |
| maps | 704 |

프로젝트 **183개**는 SQLite에 저장하고 이력을 이관한 뒤 닫았다가 다시 열어
저장 해시가 같음을 확인했다. 대화의 대상 범위도 새 프로젝트 id에 맞게 연결했다.
프로젝트별 건수와 대응은 비공개 IMPORT.json에 있다.

원본 **6개**는 현재 로더가 거부하여 정상 프로젝트로 계수하지 않았다:

- `game-jam-g1-selftest-delete-me`: assets가 객체가 아닙니다.
- `game-jam-g3-1789854078`: version가 숫자가 아닙니다.
- `oprn-hill-forest-harmony-20260918-a4e1`: tileset tileset_peaceful_forest_100: tileGroups[55] tileId out of range
- `rpg-zzu-agent-jrpg-demo`: map map_mine.events[0].pages[0].commands[1].fields.color 값이 카탈로그 옵션에 없습니다: #1a2030
- `rpg-zzu-aooni-chase-demo`: map map_mansion_hall.events[3].pages[0].commands[2].fields.color 값이 카탈로그 옵션에 없습니다: #ffffff
- `rpg-zzu-cheolsu-memory-20260905-df12`: map memory_summer.events[1].pages[0].commands[1].fields.color 값이 카탈로그 옵션에 없습니다: #ead2a0

이들 원본과 소속 기록은 아카이브에 보존하며, 오류를 감추려고 프로젝트 내용을 바꾸지 않았다.
외부 HTTP(S) 참조는 원본 프로젝트 문서 전체를 파싱하여 조사했다. 결과는 같은 아카이브
폴더의 external-references.json에 보관한다.

## 검증과 제한

- 에디터 packaged 빌드, Electron 브리지 빌드, 플레이어 빌드 및 관리 도구 구문을 확인했다.
- 생성된 플레이어 파일·manifest·lock은 정식 빌드/동기화 도구로 함께 갱신했다.
- 사용자 명시 요청이 없어 테스트·게이트는 실행하지 않았다.
- 원본 프로젝트가 조사 중 181개에서 189개로 증가했다. 다른 작성자가 살아 있으므로
  테이블별 건수 확인을 전역 동일 시점 스냅샷이라고 해석하지 않는다. 원본 서비스는 종료하지 않았다.
- 과거 증거의 명칭·경로 정리는 과거 결과의 재실행을 의미하지 않는다. Git 이력은 재작성하지 않았다.

최종 파일 감사: 현재 추적/신규 텍스트와 경로, dist, dist-electron, 설치된 플레이어 번들에서
옛 공급자 명칭은 **0건**이다. 삭제 파일의 실행 import 참조도 **0건**이며,
`git diff --check`와 플레이어 13파일 manifest/lock 검사가 통과했다.
프로젝트 문서의 외부 HTTP(S) 참조도 **0건**이다.

최신 기본 브랜치 병합 중 추가된 원격 발행·스냅샷 전용 스크립트 5개도 제거했다.
함께 추가된 마을·타일·참조 패키지와 저작 내용은 보존하고, 참조 문서의 저장소 명칭만 정리했다.
