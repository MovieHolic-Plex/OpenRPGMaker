# 버들 황록 마을 · 50×50

## 결과

- 새 맵 `map_beodeul_village50`, 50×50칸, 원본 16px, 전체 그림 800×800.
- 건물 18동: 민가·회관·주막·대장간·교회. 기존 지붕·윤곽·돌집 박공을 유지한다.
- 남북 물길, 아치 다리 2개, 우물 마당, 공유 흙마당과 좁은 접근로.
- 나무 본체/숲 조각 13곳. 선택한 `warm` 색으로 공용 나무 3종과 기존 숲 4종을 조립한다. 수관은 일부 길 위로 드리우고 밑동은 길·문 앞을 막지 않는다.
- 실제 길만 사용하는 canMove 경로로 18개 문 앞과 네 다리 둑의 연결을 확인했다.
- 원래 네 맵의 전체 데이터는 보존했다. 시작 위치는 새 마을 우물 마당 (32,16)이다. 새 실내/출입 이벤트는 이 외장 표본에 포함하지 않는다.

## 남쪽 포석길 정정

건물과 겹친 길을 지우면서 포석길이 끊겼으나, 북쪽 흙길로 우회하는 경로가 기존 검사에 통과했다. 교회 앞 (9,44)에서 남쪽 다리 서안 (22,37)까지 y≥37의 빈 지면으로 연결하고, 포석길·다리 갑판만 쓰는 canMove 경로를 별도로 확인했다. 흙길·포석길의 접점은 전체 도로 이웃을 기준으로 칠해 내부 잔디 틈을 없앴다. 지면 161칸만 바뀌었고 다른 레이어·그림자·이벤트는 동일하다. 자세한 근거는 `../beodeul-village50-road-fix/README.md`.

## 저장·재로드

- project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 정본: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004/project.sqlite`
- 최종 revision: `23`
- SHA-256: `1091b1f296b00b9a6a68c3d45cde1e9ce045424ffc8ec4bb5e4f13070d20fd3c`
- `canonical-proof.json`: SQLite API 저장 후 별도 프로세스에서 전체 새 맵·기존 맵·공용 참고문서를 대조했다.
- `preview.png`와 `reloaded.png`의 RGB 픽셀 해시는 동일하다: `2d85e49d069bf46620043b3561f61e5b4c3b41b63ae2fa0b6432a19f09cef6f7`.

## 공용 자료

`beodeul_warm_trees` / `tex_beodeul_warm_trees`: 16px·8열·328칸. 선택한 색만 치환했고 원래 알파·줄기·뿌리·숲 겹침·바닥 그림자를 유지했다. `public/assets/beodeul-warm-trees/pixel-proof.json`과 생성 코드가 source 검사를 기록한다. 그림·칩셋 정의·기하·기본 프로젝트에 배선했다. `fresh-proof.json`은 실제 defaultTilesets 생성 결과의 공용 등록과 그림 치수, 새 city/ground의 전체 문서/이미지 일치를 확인한다.

학습 정본은 `tiledata/beodeul-ground/VILLAGE50.md`, `village50-example.json`, `warm-trees-catalog.json`. 공용 참고문서는 전체 네 층 배열, 사용 키트, source→target 이식표와 통행/우선순위, 나무 전체 사전, 정상/실제 갑판 누락 오류 그림을 포함한다. 오류 그림을 직접 열어 검수했다. 실제 갑판을 물로 바꾸면 첫 다리 (22,16)→(23,16)의 canMove가 true에서 false로 바뀐다.

## 화면·이동 검수

`runtime/SUMMARY.md`를 먼저 읽었다. 전용 player.html에서 실제 도보로 두 다리, 회관, 교회, 대장간, 우물 복귀를 수행했다. 9비트 통과, 실행 오류 0개. `runtime/overview-player.png`는 전체 화면 확인용이다. 이동 검사는 새 실내 출입이나 미적 합격을 대신하지 않는다.

사용자에게 보여주는 그림은 재로드와 픽셀 일치하는 전체 맵이다. `visual-lossless.png`는 RGB로 무손실 압축한 사본이며 팔레트 축소가 아니다. 전체·우물·교회·주거 선택이 실제 그림의 크롭을 변경하고 320px에서 가로 넘침이 없으며 JavaScript 오류가 없다 (`visual-proof.json`). 전체 그림·우물 확대·모바일 화면을 직접 확인했다.

전체 gates/vitest/typecheck는 실행하지 않았다.
