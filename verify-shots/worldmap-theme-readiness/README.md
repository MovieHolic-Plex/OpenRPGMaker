# 세계관별 준비 상태와 실제 우주 조수 확인 — 2026-10-04

먼저 `assistant-space-final/reloaded-audit.json`을 읽는다. 실제 그림은 `assistant-space-final/world_star_voyage.png`와 `gallery.png`다.

## 실제 조수: 우주 항해 지도

- 실제 `opencodex/gpt-6-astra`, 편집기와 같은 Pi 실행·도구 발견·실제 공용 SQLite 자료 조회.
- 요청에 도구 ID·좌표·테마 ID는 주지 않았다. 요청 원문은 `assistant-space-final/task.txt`.
- 새 `list_worldmap_themes`를 읽고 성계 지도와 외계 행성·거점 자료의 준비 상태를 구분했다.
- 최종 19회 도구 호출, 오류 0건. 96×72 지도, 성계 27개·항로 18개, 캐릭터 75%, 논리 5막 여정 검사 통과.
- 사람 선택 우주 아이콘은 0개. 거점 31곳은 이름·좌표만 남고 후보 그림은 붙이지 않았다. 조수도 이를 완료 보고에서 명시했다.
- 기존 시작 맵·위치 보존, 이벤트 0개. 거점 내부·워프 해금·게임 전체 진행은 제작하거나 검사하지 않았다.
- 별도 SQLite 정본 저장 후 닫고 재열어 실제 PNG·지형 설정·크기·지도 소유 타일셋을 대조했다.

정본: `/home/main/.local/share/oprn/worldmap-shared-ai-space-readiness-final-20261004`

project id: `39f1a0ee-dc73-47f1-8e25-6834147a2a03`, 재로드 판본 2.
이번 우주 시험 프로젝트는 공용 DB 라이브러리로 발행하지 않았다. 공용 자료 조회와 정본 결과 저장은 서로 다른 단계다.

처음 실행은 22회 중 존재하지 않는 `worldmap_starmap` 타일셋 조회 오류 1건을 스스로 복구했다(`first-attempt.json`).
세계관 목록에 생성 후 타일셋 ID 계약과 선택 상태를 추가한 뒤 같은 원문으로 새 프로젝트에서 다시 실행했다.
최종 결과에 UI 의도 판정·클릭 흐름은 포함하지 않는다.

## 17개 기본 테마

테마 JSON·후보 manifest·사람 선택 manifest가 출처다(`catalog.json`). 기본 미리보기와 논리 여정 검사는 15/17 통과했다.
이 표는 모든 테마에서 실제 조수가 게임을 완성한다는 증거가 아니다. 특히 공용 그림 준비 상태와 지형 검사는 별개다.

| 세계관 | 선택된 월드맵 아이콘 | 기본 미리보기·여정 |
|---|---:|---|
| 외계 행성 | 0 | 통과 |
| 고대 그리스·로마 | 0 | 통과 |
| 다크 판타지·고딕 | 0 | 통과 |
| 사막·동양풍 | 21 | 통과 |
| 판타지 던전·신전 | 0 | 통과 |
| 판타지 (기본) | 36 | 통과 |
| 조선 | 0 | 통과 |
| 현대·SF | 22 | 통과 |
| 현대 소도시 | 0 | 통과 |
| 몬스터 수집 | 0 | 통과 |
| 선사·원시 | 0 | 통과 |
| 바다·군도 | 0 | 통과 |
| 일본 전국 | 0 | 실패 |
| 설원·북방 | 0 | 통과 |
| 성계 지도 | 0 | 통과 |
| 스팀펑크·마도 | 0 | 통과 |
| 무협 중국 | 0 | 실패 |

남은 기본 생성 실패(`preview-checks.json`):

- 일본 전국: 고원 마을→사막 촌락 길이 바다에 막힘. 자동 배치 6회로 복구하지 못했다.
- 무협 중국: 실제 지리의 배 장벽 바다가 2칸보다 좁음. 자동 배치 6회로 복구하지 못했다.

이 두 기본값은 이번 수정에서 고치지 않았다. 단일 시드/기본값 확인이며 다른 범위·시드의 가능성을 판정한 결과가 아니다.

## 수정과 독립 확인

- 호스트 빌더는 `--selected-icons selected/selected.json`을 사용한다. 후보 세트는 하네스 검수용이다.
- 선택 그림의 SHA256·칸 크기를 검사한 뒤 원본 RGBA를 합성한다. 미선택 또는 발자국 불일치는 `iconSelection.pending`으로 돌려준다.
- 우주·외계 거점 전용 칩셋이 없을 때 로마풍 기본 마을로 대체하라는 안내를 제거했다.
- 판타지·현대/SF 전체 렌더의 실제 그림에서 선택 원본의 불투명 화소 72,485개 일치와 여정 통과를 확인했다(`selected-render-checks.json`).
- 기존 사람 선택 79개·1,620칸의 해시/배열/PNG/참고 그림 일치도 하네스 `check`로 확인했다.
- gates/vitest/전체 typecheck와 원격 DB 쓰기는 실행하지 않았다.

재현:

```sh
node scripts/content/prepare-worldmap-theme-catalog.mjs
node scripts/qa/worldmap-theme-catalog-check.mjs
node scripts/qa/worldmap-theme-selected-render-check.mjs
bun scripts/qa/worldmap-shared-assistant-live.mts --label <새 이름> --generated-theme starmap --out <증거 폴더> --task-file <원문> --model opencodex/gpt-6-astra
bun scripts/qa/worldmap-theme-reloaded-audit.mts <증거 폴더>
```
