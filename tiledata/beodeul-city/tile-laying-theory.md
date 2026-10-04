# 타일 까는 이론 — 버들항 조수가 실제로 쓰는 것만 (라운드 4)

라운드 3 약점(바둑판 격자·직선 운하·같은 블록 근접 반복·막다른 길 12개)에서 출발해 도시·지형 절차 생성 문헌을 훑고,
**조수의 툴로 실행할 수 있는 것만** 남겼다. 알고리즘 그대로는 못 쓰는 것(텐서장·WFC)은 "왜 못 쓰나"와 "대신 무엇을 쓰나"를 적는다.
조사일 2026-09-29. 각 항목: 무엇 / 어디에 적용 / 실행 형태 / 출처.

## 채택 (조수 절차·자에 들어감)

### 1. Lynch 다섯 요소를 배치 전에 고정 — 계획 단계
- **무엇** Kevin Lynch, *The Image of the City*(1960): 사람이 도시를 기억하는 뼈대는 길(paths)·경계(edges)·구역(districts)·결절점(nodes)·랜드마크(landmarks) 다섯이다.
- **어디** 조수의 1단계(역할 격자) 맨 앞. 블록을 찍기 전에 다섯 칸을 좌표로 못 박는다: 경계=운하·해안, 길=대로 1~2줄, 구역=이름 붙은 3~5개, 결절점=광장 2곳 이상(≥24칸), 랜드마크=구역 킷(성·성당·풍차 등) 좌표.
- **실행 형태** `bd-work-order.md` 1단계 표. 결절점 수·랜드마크 수는 `check_city_form` 이 센다.
- 출처: https://en.wikipedia.org/wiki/The_Image_of_the_City · https://www.architecturecourses.org/design/kevin-lynchs-5-elements-city-guide-urban-design

### 2. 길 위계(대로 → 거리 → 골목)와 "깨진 격자"
- **무엇** Parish & Müller 2001(CityEngine 계열)은 큰 길을 먼저 깔고 작은 길이 갈라진다. Chen 등 2008은 큰 길·작은 길을 서로 다른 방향장에서 만들어 곧은 관통로가 사라진다. Townscaper(Stålberg)는 불규칙 사각 격자 위에서 짓는다. 공통점: **모든 길이 같은 격자에 얹히지 않는다.**
- **어디** 대로 폭 3~4, 거리 2, 골목 1은 이미 있음(`bd-street-hierarchy`). 새로 넣는 것: (a) 곧은 길 45칸 상한, (b) 한 줄은 중간에서 4~8칸 어긋나게(jog), (c) 대각선·휜 거리 1~2줄, (d) 평행 대로 간격을 같게 하지 않는다.
- **실행 형태** 휜 길 = `fill_region` 폭 3 사각형을 행마다 옮겨 이어 붙이기(`bd-street-hierarchy` 예). 어긋남·상한은 `check_city_form` 의 `longStraight`, `spacing.cv`, `bentStreetCells`.
- 출처: https://dl.acm.org/doi/abs/10.1145/383259.383292 · https://www.sci.utah.edu/~chengu/street_sig08/street_sig08.pdf · https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making
- **못 쓰는 부분** 텐서장 적분 자체. 조수는 좌표 사각형을 부르는 툴만 있다. 그래서 "방향장" 대신 **구간별 중심선 좌표표**를 계획 단계에서 적게 한다.

### 3. 자연 지형은 굽이로 — 운하·강
- **무엇** 곧은 수로는 인공물의 표지다. 굽이(bend)는 중심선 좌표가 좌우로 번갈아 움직이는 것이다. 다리는 굽이 사이 곧은 구간에 둔다.
- **어디** 운하·강 경계 요소. `bd-layout-rules` 5절의 "곧게" 규칙을 폐기하고 "굽이 2번 이상, 폭 4~6 가변"으로 바꿨다.
- **실행 형태** `fill_region` 행별 사각형(휜 길과 같은 방식). 검사: `check_city_form` 의 `canal.straightShare`(중심선 ±1.5칸 안 행 비율, ≥0.85 이면 곧음)와 `canal.bends`.
- 출처: 라운드 3 렌더 관찰 + Chen 2008 (자연 지형이 만든 곡선 도로망). 수치 기준은 이 저장소의 실측(r3 운하 straightShare 1.0).

### 4. 공간 구문론(space syntax) — 축선 그래프로 막다른 길·격리를 잰다
- **무엇** 곧은 통로의 최대 연속을 축선(axial line)으로 보고 그 연결 그래프의 깊이(depth)·통합도(integration)로 도시를 판정한다. 막다른 길 위주의 성기 구조는 깊이가 크고 격리 구간이 생긴다. 격자형 연결 도시는 평균 깊이가 낮다.
- **어디** 마감 전 검증(4~5단계). "막다른 길이 몇 개냐"뿐 아니라 "길망에서 떨어진 길이 있는가", "평균 깊이"를 함께 본다.
- **실행 형태** `check_city_form`: `deadEnds`(좌표 목록), `graph.meanDepth/maxDepth/isolated`. 조수는 완료 선언 전에 반드시 한 번 부르고 좌표를 고친다.
- 출처: https://en.wikipedia.org/wiki/Space_syntax · https://journals.sagepub.com/doi/10.1177/2399808318786512

### 5. 반복은 이웃 제약이 아닌 "횟수 제약"으로 — WFC/모델 합성의 교훈
- **무엇** WFC(Gumin)·모델 합성(Merrell)은 국소 인접만 보장한다. 국소 인접이 맞아도 전역 반복(같은 조각이 자주 나옴)은 못 막는다 → 조각 빈도·횟수 가중을 별도로 둔다.
- **어디** 블록 킷 41종(폭 10/14/20 × 높이 8/13/17, 변형 -b/-c). 규칙: 같은 id 는 맵에 2번까지, 이웃(x 겹침+y 간격 ≤20 또는 반대) 금지.
- **실행 형태** `check_city_form` 의 `blocks.neighbourRepeats`(쌍의 좌표)·`overused`. 조수에게 "어느 좌표 둘 중 하나를 다른 종류로 바꿔라"까지 말한다.
- 출처: https://github.com/mxgmn/WaveFunctionCollapse · https://paulmerrell.org/wp-content/uploads/2021/07/comparison.pdf · https://www.boristhebrave.com/2021/10/26/model-synthesis-and-modifying-in-blocks/
- **못 쓰는 부분** 엔트로피 최소 칸 선택·전파 알고리즘. 조수는 블록을 하나씩 순서대로 찍는다. 그래서 알고리즘 대신 **찍기 전 예약표**(블록 자리마다 종류를 미리 적고 겹침 확인)를 쓴다.

### 6. 계획 → 실행 → 검증 → 수리 순환 (LLM 절차 생성)
- **무엇** LLM 이 맵을 한 번에 다 그리면 무너진다. 계획 산출물(역할 격자·좌표표)을 먼저 만들고, 실행 뒤 **기계 검증 결과를 되먹임**으로 수리하는 루프가 결과 품질과 재현성을 올린다는 보고가 있다.
- **어디** 조수 5단계 전체. 이번 라운드에서 검증이 "읽고 판단"에서 **`check_city_form` 툴 한 번 호출**로 바뀌었다(툴 호출 3~5번 = 입력 재전송 없는 짧은 턴).
- 출처: https://arxiv.org/pdf/2512.10501 · https://dl.acm.org/doi/10.1145/3723498.3723840 · https://www.emergentmind.com/topics/procedural-content-generation-with-llms

## 채택하지 않음 (이유)
- **텐서장·L-시스템의 자동 도로망 생성**: 조수의 툴 어휘에 없다. 좌표표로 손으로 옮겼다(2번).
- **WFC 엔트로피 전파**: 블록이 타일 하나가 아니라 10~20칸 킷이고 이미 내부가 완결이다. 반복 제어(5번)만 취했다.
- **Voronoi·필지 분할(Parish 의 lot subdivision)**: 블록 킷 크기가 고정이라 분할할 필요가 없다. 대신 킷 크기 3종 조합으로 불규칙 블록 폭을 얻는다.

## 문서 무게 원칙
참고문서를 늘리면 읽기 관문이 그 무게를 매 턴 다시 보낸다(r3 실측: 29번 읽기 ≈ 턴당 13만 토큰). 그래서 이번 라운드는 문서를 **추가하지 않고** `bd-work-order`·`bd-street-hierarchy`·`bd-layout-rules` 세 쪽을 고쳐 쓰고, 이론 원문은 조수에게 읽히지 않는다(이 문서는 코딩 에이전트·검토자용).
