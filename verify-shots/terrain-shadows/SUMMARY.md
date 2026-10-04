# 도로와 높이 붓 지형의 태양 그림자

## 수정

- 화면에 실제로 보이는 수신 면은 native `renderRelief`의 `src/kind/mpy/height`로 결정한다.
  이전의 월드 줄별 투영은 앞 지형에 가려진 바닥도 그렸다. 도로·고지·절벽의 주인 줄을
  하나로 정하고 해당 월드 높이에 광선을 쏜다.
- 경사로 둘레의 네모 가장자리를 광선 높이에도 적용한다.
- 레이어 입력에 revision-aware `reliefReadSignature`를 포함한다. 높이 변경은 갱신하고,
  default off에서는 높이 서명과 수신 면을 계산하지 않는다.
- 기본 off/65°, 저장된 태양 수치, 버들항 원본 타일, 통행 데이터는 그대로 사용한다.

## 근거

`scripts/qa/terrain-shadow-fixture.mts`는 별도 SQLite QA 프로젝트를 만들며 원본 프로젝트에 쓰지 않는다.
baseline은 PR #2102 merge `63a2d681444d10b8355f6fe49d775496477c1945`의 그림자 모델이다.
`scripts/qa/terrain-shadow-audit.mts`는 **전체 native 지형 렌더의 주인 줄**과 작은 그림자 창을
독립적으로 비교한다. 구현의 창 캐시끼리 비교하는 계약이 아니다.

| 재현 맵 | 이전의 가려진 수신 표본 | 수정 후 | 겹쳐 칠한 표본 |
|---|---:|---:|---:|
| 높이 붓 + 도로 | 115 | 0 | 0 |
| 버들항 네 집 + 고지 | 10 | 0 | 0 |

추가 확인: 건물/나무 없는 러프 붓 지형의 그림자, 높이 없는 도로의 caster/그림자 0,
네 방향 태양의 낮은 지면 수신, 실제 버들항 집 네 개의 native 알파 실루엣.
숫자는 이 재현 맵의 4×4 표본이며 전체 미술 품질 지표가 아니다.

## 실제 에디터와 저장

- 정본 QA: `.vite-cache/terrain-shadows/project/project.sqlite`
- project id: `67792e6b-c160-4eb4-9e93-d3c59dace1bb`
- 사람용 높이 붓으로 새 고지를 6단까지 만들고 `maxTerrain` 4→6과 그림자 rebuild를 관측.
- 태양 off/on, 북서/남동, 45°/65°를 실제 컨트롤로 변경.
- 저장·브라우저 재로드 revision **11**, 새 지형과 수치 일치, 다른 세 맵 내용 동일.
- 무변화 상태에서는 다시 굽지 않음. browser page errors **0**.
- 즉시 확인: `editor/02-brush-shadow.png`, `editor/03-off.png`, `editor/05-default-sun.png`.
  `editor/06-reloaded.png`는 앱 기본 줌으로 복귀한 재로드 화면이다.

## 출하 플레이어

`player.html`과 내보내기 store shim을 통과한다. 편집기 play 모드는 쓰지 않았다.
북서 65°/북서 45°/남동 45°의 프레임은 서로 다르고, off와 맵 이동에서 텍스처 0.
idle cache, 버들항 네 집의 native 실루엣, page errors **0**를 확인했다.
상세값은 `player/observations.json`에 있다.

## 실행 범위

packaged/editor, electron bridge, export player 빌드와 위의 집중 계약·브라우저 캡처를 실행했다.
AGENTS의 세션 제한에 따라 전체 gates/Vitest/typecheck는 실행하지 않았다.
건물 그림자는 현재 남아 있는 native 아트에서 추정한 2.5D 형상이며 이번 수정은 수신 면과 높이 갱신이다.
원본 사용자 프로젝트의 맵·태양 설정은 편집하지 않았다.
