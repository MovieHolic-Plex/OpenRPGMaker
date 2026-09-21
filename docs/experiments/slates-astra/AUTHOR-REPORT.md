# 느티관문 — 우물길 성곽마을 / 독립 저작 제출

50×50, 32px 타일의 새 성곽 마을을 직접 작성한 생성기로 만들었다. 건물 12개(낮은 별동 포함), 남쪽 열린 쌍탑 관문, 우물 광장, 서쪽 주거·공방 필지, 동쪽 작은 정원, 남문 가판대가 있다. 제출물은 독립 저작 산출물이며 **LegacyDb 저장·재로드 및 실제 에디터/런타임 완료 보고가 아니다.** 해당 후속 작업은 사용자 지시에 따라 감독자 담당이다.

## 실행과 산출물

저장소 루트에서 `node scripts/content/build-slates-astra-experiment.mjs`로 재생성한다. Node 표준 라이브러리와 설치된 Playwright의 Chromium Canvas만 사용했다. 전체 gate/vitest/typecheck, stash, 커밋, 다른 에이전트 호출, DB 읽기·쓰기를 하지 않았다.

- `bundle.json`: map `slates_astra_walled_50`, tileset `slates_astra_32`, asset `slates_astra_atlas`, 시작점 `(25,48)` 및 접근 목표.
- `map.png`: 1600×1600, 전체 lower 다음 전체 upper를 그린 미리보기.
- `layout.json`: 구역의 이유, 건물 범위, 문·접근 칸, 열린 남문, 연결 결과.
- `recipes.json`: v2 원본 1232칸과 96개 파생 ID, 원본 사각형·destination·그리는 순서. 기존 관찰 스탬프를 사용하지 않았다.
- `atlas.png`: 원본과 합성 타일의 1792×768 아틀라스. count=1328이며 마지막 행 남는 슬롯은 참조하지 않는다.
- `authoring-audit.json`: 제출 데이터와 통행의 저작 점검 수치.
- `read-inputs.json`: 실제 연 입력 33개 경로와 SHA256, manifest 대조 결과.

원본 픽셀은 v2만 사용했다. 32px 전체 사각형의 순차 합성으로 받침과 소품을 만들었으며 회전·확대·재색칠·새 그림 생성은 하지 않았다. v1 및 카탈로그 JSON은 열지 않았고 기존 생성기, 앱 소스, 기존 프로젝트/맵 JSON, 이전 output/verify-shots 결과도 읽지 않았다. 자신의 생성기와 이번에 생성한 결과는 실행·교정을 위해 읽었다.

## 실제 학습 입력 및 적용 절

텍스트 입력: 실험 README와 input-manifest, `slates-agent-entry.md`, `slates-structure-learning.md`, `slates-structure-samples.md`(직접 분할 열람은 1–440행), `slates-atlas-review.md`, `slates-village-authoring.md`, `ATTRIBUTION.md`의 Slates 절. 여러 문서를 합친 초기 출력은 잘려 학습·표본·구역 문서를 별도 범위로 재열람했다. 문서에 링크된 금지 경로는 따라가지 않았다. 운영 지침은 대화에 제공된 AGENTS를 따랐다.

이미지 입력: 원본 `public/assets/slates/slates-v2-32px.png`와 다음 `openwiki/images/slates/mastery/` PNG 24개를 이미지 도구로 실제 열었다.

- 구조 비교·부품: projecting-house, projecting-house-parts, roof-deep, roof-deep-parts, wall-long, wall-parts, parapet-corner, parapet-corner-parts, gate, gate-parts, joined-shops, inn.
- 번호판: region-roof, region-battlement, region-towers, region-timber, region-castle-face, region-balcony, region-court-border, region-paving, region-small-props, region-single-trees, region-red-awning, region-blue-awning.

40개 구조 표본의 모든 비교 PNG나 46개 구역의 모든 번호판을 열었다고 주장하지 않는다. 이번 지상 마을에서 사용한 건축·성벽·수목·소품 중심으로 선택했다. `read-inputs.json`이 전체 파일 목록이다.

적용한 주요 내용:

- 구조 학습 §1: v2 56열, id=y×56+x, source 픽셀 좌표와 타일 좌표를 구분.
- §2 및 roof-deep/projecting-house: 지붕 폭과 깊이를 분리하고 앞 박공·상층 창·돌출층 아래 받침·문·기단을 순서대로 저작.
- §3 및 wall/wall-long/parapet-corner: 뒤 경계·막힌 보행면·앞 흉벽·전면·기단 구분. 657/658을 바닥으로 반복하지 않음. 원본 측면 부재 사용, 회전 없음.
- §3 gate의 hold: 보류된 격자/아치 복원 대신 두 탑 사이 4칸의 열린 지상 통로 채택.
- §4: 624의 원본 알파 그림자를 해당 바닥 위에 합성. 높은 보행면과 지상을 함께 통행 가능으로 만들지 않음.
- §6: 성곽과 남문 → 구획과 건물 → 골목/접근 → 소품. 중앙 필지는 최종 교정에서 작은 약초방으로 채움.
- 마을 저작 §2–6: 지형 중심과 경계, 문 뒤 벽 받침, 나무 수관/밑동 분리, 한 칸 우물, 두 레이어 및 전용 칩셋의 통행 메타.

## 독립 결정

기존 마을 배치를 복사하지 않았다. 남문에서 북쪽 회관으로 곧장 큰 십자길을 내지 않고, 남문 장터·중앙 작은 건물·우물 광장을 따라 꺾이는 3–4칸 도로와 필지 사이 좁은 골목을 구성했다. 서쪽 작은 집들의 폭은 4칸, 회관과 여관은 6칸이며 깊은 지붕의 반복 길이와 돌출층 유무를 달리했다. 회관 오른쪽에 낮은 기록실을 붙여 높이가 다른 접합을 시도했다.

원통 탑은 가로로 늘리지 않고 원본 폭을 유지했다. 성벽 및 지붕은 전체 통행 불가이며 지상만 플레이어 접근 대상으로 삼았다. 문은 닫힌 장식이며 문 앞만 접근 목표다. 간판 명칭으로 실제 상점·여관 기능을 약속하지 않고 용도는 layout 이름에만 기록했다. 실내·NPC·상거래·문 개폐 이벤트는 없다.

## PNG 직접 검토와 교정

첫 생성 뒤 `map.png`를 실제 열었다. 다음 문제를 확인하고 생성기를 수정·재실행했다.

1. 깊은 지붕에서 37/38을 반복한 면이 다른 지붕 결을 끼워 넣어 큰 이음새를 만들었다. 좌우 경사면을 36/39 반복으로 바꾸고 앞쪽 중앙에 작은 박공과 창을 연결했다.
2. 회관 기록실의 상단이 원치 않는 노란 삼각 틈으로 끊겼다. 지붕 시작 부재를 재선택했다.
3. 남문 오른쪽 탑이 가판대 `(28,37)`의 앞칸 `(28,39)`을 막았다. 가판대를 `(30,37)`로 옮겼다.
4. 중앙의 큰 빈 모래 필지에 `(24,24)` 약초방을 추가하여 광장과 남문 사이의 건물 밀도를 높였다.

수정본 전체 PNG를 다시 실제 열어 지붕 연결, 기단, 우물 주변 빈 칸, 남문 통로, 가판대 앞 공간을 살폈다. 최종 반복 실행은 감사·출처 기록만 더했으며 그림 배치는 이 수정본과 동일하다. Canvas 원본 픽셀 조립의 검토이며 앱 렌더 검증을 대신하지 않는다.

## 통행 근거

2500칸의 lower/upper 차단 합집합과 제출 tileset.passability가 일치함을 생성기에서 확인한다. 모든 ID 범위와 배열 길이도 확인한다. 시작점에서 4방향 flood fill로 1380칸에 도달하며 제출 접근 목표 20개가 모두 연결된다. 남문 `(x=24..27,y=44)`만 가상으로 막으면 성 밖 시작점에서 내부 광장에 도달하지 못하므로 성벽 둘레에 별도 누출 경로가 없는 것을 확인했다. 이 가상 차단은 제출 맵에 적용하지 않았다.

성벽 위 보행면·지붕·건물·탑·나무 밑동·벤치·판매대는 막았다. 수관과 작은 꽃은 통행을 유지한다. 두 레이어와 한 칸 충돌 때문에 수관 밑 보행의 실제 캐릭터 가림은 감독자의 엔진 확인이 필요하다. 전체 저장소 테스트를 실행한 결과로 표현하지 않는다.

## 남은 한계와 감독자 인계

- 집들의 큰 박공과 정면 표현이 여전히 유사하고 서쪽 필지는 규칙적이다. 학습 비교판의 섬세한 반칸 돌출·복잡한 지붕 교차·유기적인 밀도 수준에는 미치지 못한다.
- 32px 전체 조각을 선택했으므로 반칸 기단·창 배치의 정교함은 제한된다. 별동 접합은 단순하며 임의 T/L 건축 생성 규칙을 해결한 것은 아니다.
- 측면 성벽은 두 경계 사이의 막힌 보행면으로 단순화했다. 남북 성벽처럼 수직 전면을 모두 보여주지 않으며 모서리 쌍탑 역시 보수적인 반복 조합이다.
- 성문은 항상 열린 틈과 쌍탑으로 표현했다. 보류된 성문 원본 복원, 아치 아래 통행, 개폐, 성벽 위 보행을 해결했다고 주장하지 않는다.
- 나무는 소수 독립 나무만 배치했다. 군락·묘역·물·다층 계단은 이번 배치에 없다. 큰 지형은 직사각 경계이며 불규칙 오목 지형 합성은 하지 않았다.
- 수치상 연결은 건축 품질 보증이 아니다. 상점 등 이름은 위치 설명이며 플레이 기능은 미구현이다.
- 실행 중 모델 선택·reasoning effort를 바꾸거나 독립적으로 확인할 도구를 사용하지 않았다. README의 GPT 6 Astra medium 실행 조건 충족 여부는 감독자가 실제 실행 메타데이터로 확인해야 한다.
- DB 연결과 최신 SHA는 사용자 제공 전제다. 이 담당자는 자격증명·DB·기존 콘텐츠를 읽거나 수정하지 않았다. 감독자가 스키마 대조, LegacyDb 저장·재로드, 실제 에디터 렌더 및 캐릭터 충돌을 확인하기 전에는 전체 작업 성공을 선언하지 않는다.

## 변경 파일과 저작권

쓰기 범위는 `scripts/content/build-slates-astra-experiment.mjs`와 `verify-shots/slates-astra-experiment/`뿐이다. 산출물 폴더에는 bundle.json, map.png, layout.json, recipes.json, REPORT.md, atlas.png, authoring-audit.json, read-inputs.json을 작성했다.

타일 저작자: **Ivan Voirol**, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), [원본 배포](https://opengameart.org/content/slates-32x32px-orthogonal-tileset-by-ivan-voirol). 원본 저장소 PNG는 상단 제목 32px가 이미 제거되어 있다. 이번 변경은 원본 사각형의 배치·받침 합성과 신규 지도 저작이며 원본 픽셀 색은 유지했다. 배포 시 저작자·출처·라이선스·변경 표기를 유지해야 한다.
