# 실제 AI 조수: 절벽·버들항 고지 집·경사로

2026-10-04. 모델 응답/도구 호출을 대체하지 않은 실제 생성 두 번과 출하 플레이어 확인이다.
사용자 정본 지도는 변경하지 않았다. 기존 타일 참고문서 원문·실제 이미지를 읽고 같은 번들 부품을 사용했다.

## 생성 전후

| 항목 | 기존 연결 | 도구 연결 후 |
|---|---:|---:|
| 실제 모델 | opencodex/gpt-6-astra | opencodex/gpt-6-astra |
| 시간 | 652.885초 | 371.674초 |
| 실제 도구 호출 | 105 | 41 |
| 실패 호출 | 65 | 0 |
| 집 | 0 | 3 |
| 매끈한 경사로 칸 | 0 | 44 |
| 계단 칸 | 0 | 0 |
| 문 앞 칸 자체 도달 | 0/3 예정 위치 | 3/3 실제 문 앞 |
| SQLite 저장 후 같은 지도 재로드 | 같음 | 같음 |

기존 모델은 경사로 도구를 찾지 못했고, 이미지 읽기의 offset=0이 반복 거부됐다.
집/도로/경사로 미완료와 통행 실패를 실제 최종 응답에도 보고했다.
최초 claude-opus-5.5 시도는 설정된 서버에 연결되지 않아 도구를 부르기 전에 끝났다. 위 표의 두 실행은 연결되는 실제 모델이다.

연결 뒤 모델은 참고문서 9회, sculpt_relief 4회, place_terrain_house 3회,
lay_terrain_road 3회, place_terrain_ramp 3회, inspect_terrain 3회, check_terrain_access 2회를 직접 호출했다.
중앙 골짜기·굽은 다단 능선·서로 다른 세 고지를 저작했다. 고지 프리셋을 고른 결과가 아니다.

| 버들항 외관 | 실제 집 영역 | 문 앞 | 높이 | 전체 집터+문 앞 |
|---|---|---|---:|---|
| 초록 문 통나무 | (11,19) 9×5 | (15,24) | 4 | 평탄 |
| 파랑 문 통나무 | (44,25) 13×5 | (50,30) | 6 | 평탄 |
| 붉은 꽃 반목조 | (36,5) 11×8 | (41,13) | 9 | 평탄 |

시야 차단·고지 시야·발사체 높이 규칙은 OFF다. 외관만 요청했으므로 실내/문 이벤트는 만들지 않았다.
모델 생성은 CLI의 실제 runPiAgent·도구 노출/발견·참고문서 게이트를 사용하지만 UI 의도 선언 요청은 대신하지 않는다.
당시 모델에 반환된 PNG는 아직 평면 타일 그림이었다. 실제 relief 행렬과 통행은 검사했으며, 모델도 그림의 한계를 밝혔다.
이후 browser/headless 미리보기를 같은 엔진 절벽 줄 띠와 들림으로 고쳤다. 그림 수정 전 생성 모델이 높이 그림을 봤다고 주장하지 않는다.

## 정본 저장과 출하 플레이어

- 기존 결과 project id: `1e617cda-7ba8-475b-a962-5ae82f30abb4`, 저장 폴더 `.vite-cache/terrain-ai/baseline-project`.
- 연결 후 결과 project id: `1b54a408-19e2-471a-9582-0872e77af853`, 저장 폴더 `.vite-cache/terrain-ai/fixed-project`.
- 각각 local-store API로 SQLite에 저장하고 닫은 뒤 같은 폴더를 다시 열었다. 두 지도 모두 원래 모델 결과와 JSON 값이 같다. revision=2.
- `runtime/observations.json`: 실제 연결 후 저장 결과를 prepareWebExport로 내보내고 전용 player.html/shim에서 실행했다.
  세 독립 이동 시험은 시작점 (4,42)으로만 초기화한 뒤 실제 충돌을 쓰는 playerRoute move 명령으로 걷는다.
  목적지 순간 이동, through 이동, 높이/충돌 우회가 없다. 세 문 앞 좌표 모두 실제 플레이어 좌표로 도착, 브라우저 오류 0.
- 즉시 볼 그림: `runtime/house-1.png`, `runtime/house-2.png`, `runtime/house-3.png`, `height-preview.png`.
- `terrain-assistant-runtime-2x.mp4`: 실제 Chromium 프레임 간격을 보존해 2배속으로 만든 17.3초 영상.
  큰 프로젝트 JSON과 녹화 중간 파일은 커밋하지 않는다.

## 재현과 범위

실제 에디터에서도 같은 SQLite 프로젝트를 열어 기본 Google Antigravity / Gemini 3.8 Flash로 읽기 검수를 했다.
정상 UI 의도 선언과 읽기 레일을 통과했고, 조수가 inspect_terrain → check_terrain_access → show_map_region을
실제로 호출했다(3회 성공, 쓰기 0회). 실제 요청에 실린 PNG도 바이트·SHA-256·크기로 보존했다.
전체 지형 그림은 `editor/model-image-b333e88869b2.png`이며 같은 엔진 절벽과 들림을 포함한다.
조수 최종 응답과 에디터 화면은 `editor/02-real-assistant-inspection.png`, 네트워크 메타데이터/감사 기록은
`editor/observations.json`에 있다. 검수 후 같은 SQLite를 다시 열어 지도 값이 변하지 않은 것을 확인했다.
첫 준비와 턴 정산은 큰 번들 자료 때문에 오래 걸렸으며 Chromium 검수는 중단하고 기존 실전 하네스와 같은
Firefox로 완료했다. 이 증거는 준비 지연의 해소를 주장하지 않는다. 린트 경고 1건이 표시됐으며 린트 전체 통과를 주장하지 않는다.

그 캡처에서 모델이 본 높이 그림과 달리 큰 지도 에디터의 집이 가려지는 것도 발견했다.
바닥/상층이 같은 lazy 청크에 들어가 상층도 절벽 아래에서 그려진 문제였다. 층별 부모와 들린 행 컬링을 고쳤다.
수정 후 같은 정본 지도를 다시 연 실제 에디터 그림/2배속 녹화는 `editor-visible/`에 있다.
`01-cliff-houses-visible.png`에서 세 집이 모두 고지 위에 표시되는 것을 직접 확인했다.
`observations.json`은 브라우저 오류 0과 재로드 전후 지도 SHA-256 동일을 기록한다.

- 생성: `bun scripts/qa/terrain-assistant-live.mts --project <독립 SQLite 폴더> --task <요청.txt> --model <실제 설정 모델> --out <증거 폴더>`.
  개인 모델 설정의 키는 읽기만 하며 출력/증거에 저장하지 않는다.
- 실제 에디터 채팅: `scripts/capture/capture-terrain-assistant-editor.mjs`, 같은 SQLite 호스트에서 읽기 전용 검수.
- 실제 게임 이동: `scripts/capture/capture-terrain-assistant-runtime.mjs`.
- 연결 도구 직접 확인: 평탄성 거부, 지붕만 넓힌 정의, 자동 경사로, 실제 문 앞 도달, 이미지 offset 0/1 계약.
- build:packaged, build:player, build:electron 및 git diff --check를 사용했다. gates/vitest/전체 typecheck는 실행하지 않았다.

이 사례는 실제 생성·저장·통행을 통과했다. 큰 빈 잔디 영역과 각진 집터가 남아 있으며 지형 미감이나 임의 요청의 보편적 성공을 보장하지 않는다.
