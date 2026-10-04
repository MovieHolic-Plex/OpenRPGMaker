# 실제 지리 세계 지도 — 중단된 Claude 작업의 후속 근거 (2026-10-04)

원래 세션: `77bfc270-edea-4448-84c9-a62e2aacefbc`. 세션 시작 폴더는
`/home/main/z-project/rpg-zzu`, 실제 구현은 `rpg-zzu-worldmap-iconsets`의
`agent/worldmap-real-geo`에서 이어졌다.

## 기존 조수 실행 결과

도구 이름·좌표를 사용자 기획에 넣지 않은 두 실행의 실제 파일을 다시 읽었다.
이 실행은 이전 Claude 세션에서 수행됐으며, 이어받은 세션에서는 모델 시험을 재실행하지 않았다.

| 실행 | 실제 결과 | 마지막 장면 검사 |
|---|---|---|
| `qa-runs/joseon-wm3` | `style: real`, `region: korea`; 한양은 `joseon_baram`; 세계 지도 성문 `(27,25)`과 한양 출입구 연결; 시작 `(27,26)`, 캐릭터 60% | 18/18 단계 성공 |
| `qa-runs/maya-wm2` | 프리셋 없는 유카탄에서 조수가 `box: [-93,14,-86,22]`, `home: [-89,20.8]`을 골랐다. 세계 지도와 시작 고을 연결 | 4/4 단계 성공; 고을 장면 17/17 단계 성공 |

`assistant-runs.json`은 해당 프로젝트와 도구 기록에서 필요한 결과를 추출한 사본이다.
마야 전용 야외 칩셋은 없으므로 시작 고을은 버들항이다. 실제 지형 생성의 확인 근거이며
마야 건축 그림체가 구현됐다는 뜻은 아니다.

`existing-region-renders.json`은 이전 세션의 20개 지역 전체 렌더 결과에 있는
`build-report.json.journey_check`를 읽은 사본이다. 새 스윕 실행 결과가 아니다.
기존 런타임 `worldmap-generate/SUMMARY.md`는 앞선 `joseon-wm2`를 대상으로 했으므로
이번 `joseon-wm3`의 출하 플레이어 검증으로 대체하지 않는다.

## SQLite 저장 후 재로드

기존 실행물을 새 로컬 폴더 두 곳에 보존했다. `electron/local-store/store.ts`의
`initLocalProjectStore` → `saveProject` → close → `openLocalProjectStore` →
`loadSnapshot`을 사용했으며 기존 프로젝트/실행 중인 호스트를 수정하지 않았다.

`save-reload.json`에 각 project id, 저장 폴더, revision, 해시가 있다. 재로드 후
지도 칸·이벤트·로케이션·지형 ops·캐릭터 배율·시작 위치와 원본 세계 지도 PNG를 비교해 일치를 확인했다.

## 화면 확인과 범위

[실제 지리 도감](http://mdc-server:18301/worldmap-real-geo.html)은 조수 실행에서 나온
원본 세계 지도 PNG를 사용한다. `gallery.json`은 브라우저에서 확인한 이미지 수·누락 여부,
`gallery.jpg`는 페이지 화면이다.

두 기획의 첫 범위는 세계 지도와 시작 고을이다. 기존 게임 전체 검사에는
`no-ending-trigger` 막힘이 남아 있다. 엔딩까지 갖춘 게임이 완성됐다고 보고하지 않는다.
실제 지형은 96×72칸으로 단순화되며 여정 규칙 때문에 장벽·사구·추가 섬이 실제 지리와 다를 수 있다.

이번 세션에서는 gates, vitest, 전체 typecheck, 모델 시험 및 런타임 하네스를 실행하지 않았다.
추가한 회귀 fixture(추가 타일 층·그림자·높이를 빈 맵으로 취급하지 않음)도 미실행 상태다.
