# RM2000 캐릭터 GIF 공방

GPT 6.1 sol high가 정지 4장·걷기 8장, 24×32 캐릭터의 12프레임 전부를 직접 찍는다. 사용자는 걷는 GIF를 보고 남기기/폐기만 결정한다.
머리/몸체 결손·색 키·프레임 구조와 명백한 걷기 결함을 자동 차단하며 별도 모델의 미감 점수를 선택 관문으로 사용하지 않는다.

```bash
npm run harness -- charset-actor produce --count 100 --reference /absolute/reference.png
npm run harness -- charset-actor produce --creatures --count 100 --par 2 --max-review-pending 12
npm run harness -- charset-actor produce --all-sources --distinct-sources --count 100 --par 2 --max-review-pending 12
npm run harness -- charset-actor recipe --source-run RUN
npm run harness -- charset-actor produce --seed-run RUN --count 100 --par 2 --max-review-pending 12
npm run harness -- charset-actor serve --port 18314
npm run harness -- charset-actor export RUN
python3 src/harnesses/charset-actor/harness.py publish-shared
npm run harness -- charset-actor audit --run RUN --refresh-previews
npm run harness -- charset-actor walk-qa --run RUN --out /absolute/evidence-outside-repo
```

`produce`는 작업을 터미널과 독립적으로 시작한다. 화면에서도 개수·선택적인 전체 방향·참고 그림을 넣어 시작할 수 있다.
검토 대기로 대량 주문이 멈추면 `python3 src/harnesses/charset-actor/continuous.py --run RUN --out /absolute/new-folder --par 2`로 미완성 행만 연속 제작한다. 기존 작업자를 마친 후 같은 봉인 기준의 최대 40종 묶음으로 배분하며 각 묶음은 검토 없이 끝까지 제작한다. 원래 픽셀/선택/manifest를 보존하고 연속 제작의 기본 예약은 2명이며 `--par 6`까지 지정할 수 있다. 원래 URL에서도 여러 번 이어 만든 후보까지 보이며 주문 수를 중복 합산하지 않는다. 순서 대기 묶음은 자동 제작 예정으로 표시하며 사용자가 정지하면 자동 시작하지 않는다. `--cohort-size 10`처럼 묶음을 줄여 여러 작업자에게 고루 배정할 수 있다. 첫 화면의 완성/전체/미완성/검토/남김은 후속 묶음까지 합산한다. 검토가 비어도 아직 만드는 그림이 있으면 제작 상태와 남긴 그림 보기 버튼을 표시한다. 상세 배분/중단 계약은 실행 지침의 「검토를 기다리지 않는 연속 제작」이다.
「에디터 전체 원본으로 다양하게」/`--all-sources`는 실제 `charsetCatalog.ts` 공급자 목록을 읽어 Actor/People/Monster1~6/Scarloxy/농장 동물/Template 원본을 고루 섞는다.
100종은 일반 92종+Animal 전용 8종의 같은 공방 제작 묶음이다. Animal의 몸통/앞·뒷발 정책을 유지한다. 전체 21시트·호환 원본 141칸을 봉인하고 빈 칸/정지 기물/팔레트 상한 초과는 원본 입고에서 제외한다.
`catalog_sources.py`는 원본 배경 처리만 명시적으로 정규화한다. 크기/불투명 RGB/팔레트는 바꾸지 않고 재읽는다. 원본·카탈로그 사본·라이선스·작업자 지시·입고 제외 사유·도구 해시는 기준과 선택 팩에 보존된다.
화면의 전체 원본 제작은 `distinctSources: true`로 같은 원본 픽셀을 반복 배정하지 않으며 CLI는 `--distinct-sources`를 지정한다. 원본 수를 넘으면 자동 순환하지 않고 가능한 수를 알린다. 카탈로그는 원본의 12프레임 alpha 겹침이 낮은 순서로 배정하고 실제 seed/픽셀 해시를 manifest.diversityPlan에 남긴다. 원본 배정 검사이며 산출물의 비슷한 정도를 자동 폐기하는 미감 관문은 아니다.
「남긴 그림으로 변주」는 현재 남긴 실제 12프레임을 원본으로 고정하고 각 기준의 `grid`/좌표 저작 방식을 보존한다.
제작 지시·선택 binding·원본·도구 해시를 `recipes/ID`와 실행의 `recipe/`에 보존한다. 한 작업자는 1명만 저작한다.
납품 시 12장 저작 기록/좌표 재적용·투명·PNG/RGBA·네 배경 GIF·설명·정확한 중복을 검사해 `delivery.json`에 묶는다.
새 제작의 `motionPolicy: 1`은 몸통 중앙의 정지↔각 걸음 변화, 두 걸음의 다리/발 교대, 정지 전체의 이동 복사를 추가 검사한다.
`motion.py`는 실제 RGBA와 alpha/색 경계의 위치를 비교한다. 색 치환·한 픽셀 깜빡임은 동작으로 인정하지 않는다.
원본 정지 발끝에 고정한 사람형 영역의 최소 검사이며 자연스러운 걷기를 증명하지는 않는다. 두 걸음의 상체가 같은 bob 위상인 경우는 허용한다.
`views/motion.json/png/gif`에 영역·방향·변화 좌표·느린 GIF를 남기고 현재 그림/원본/검사 구현 해시와 납품에 묶는다. 화면의 원본 비교에서도 본다.
이전 실행은 당시 계약/픽셀/선택을 보존한다. 현재 정책으로 만들려면 같은 실제 남김에서 새 기준을 만든다.
「동물 기반 몬스터」/`produce --creatures`는 번들 Animal 8종을 참고 원본으로 봉인한다. 사람의 남김으로 기록하지 않는다.
`animalPolicy: 1`은 고정한 동물 몸통 영역과 보이는 발의 교대를 검사한다. 사족보행 옆모습은 앞발/뒷발을 각각 보고,
정면/뒷면은 겹친 네 발을 추정하지 않는다. 닭은 조류용 영역이다. 사람형 정책과 증거를 보존한다.
100종·동시 2종·검토 대기 12종이 기본이며 숲/화염/서리/독/그림자/갑피 등 실제 형태를 직접 변주한다.
기술 오류만 최대 2회 같은 모델이 직접 고친다. 각 프롬프트·실패·수정 전 파일은 `attempts/`에 남기며 미감 선별은 사람에게 맡긴다.
검토 대기와 진행 중 예약의 합이 한도에 이르면 `waiting-review`, 선택이 저장되면 이어 만든다. 정지/재개는 동시 작업 수와 공개된 픽셀을 보존한다.
`produce --recipe ID`로 보존한 기준을 재사용한다. 도구가 바뀌면 다른 조건으로 자동 재개하지 않고 새 기준을 요구한다.
선택 ZIP은 제작 기준과 원본 계보·RTP 라이선스도 보존한다. 새 변주의 품질 향상은 자동 검사로 판정하지 않는다.
한 화면에 한 캐릭터의 네 방향 걷기와 게임 속 이동 GIF를 상시 보여준다. 남기기/폐기하면 즉시 다음 후보로 넘어가고 뒤에서 저장한다.
기본 화면은 검토에 집중한다. 작업 이력/정지/재개는 「제작 관리」, 검색/종류/작업 선택은 「필터」에서 펼친다. 작업 이름과 날짜를 표시하고 새 작업은 기본 12종이다.
사람과 몬스터를 독립 실행 폴더에서 함께 만든다. 기본 작업당 동시 2명, 전체 예약 최대 6명이며 정지/재개에도 같은 제한을 적용한다.
이전/다음·A/R·직전 선택 되돌리기, 일시 정지/재개, 실제 남긴 캐릭터만 ZIP 다운로드한다.
현재 serve는 봉인된 도트 도구와 분리된 `review_server.py`다. journal fsync 뒤 바로 응답하고 공용 등록/사본 복구는 뒤에서 처리한다.
목록 검사는 변경 시 공유하며 선택·생산 상태는 매번 재읽는다. 숨은 탭은 주기 조회를 쉬고 GIF 로드/공용 등록 상태를 구분한다.
새 브라우저의 걷기는 검정이 기본이며 흰색·체커·잔디로 바로 전환한다. 기존 배경 선택은 유지한다. `audit`는 12프레임과 세 배경의 원본 비교·결손 좌표·출하 PNG/GIF 대조를 저장소 밖에 남긴다.
새 옷/장식 안에 가둔 원본 배경도 투명 구멍이다. alpha 검사 정책 갱신은 같은 픽셀의 사용자 선택 binding을 유지한다.
새 제작은 `animationMode: model-12`이며 모델이 납품한 걷기를 그대로 렌더한다. `model-frames.json`에 12장 각각의 실제 픽셀 해시와 변경 수·모델을 기록한다.
`bulk` 기본은 원본 ASCII 격자를 바탕으로 12장을 직접 변형하는 방식이다. 초기 PNG 첨부·남김/폐기 참고·추가 조형 지시는 기본 제작에 넣지 않는다(2026-10-04 사용자 피드백). manifest에 `visualReferences`를 명시한 실험만 원본 시트와 참고를 첫 입력에 첨부한다. `visual-inputs.json`/meta는 기본 `[]`, 실험은 첨부 파일 순서·SHA256을 기록한다.
`audit`가 저작 기록/현재 그림 binding과 PNG/GIF를 다시 읽는다. `walk-qa`는 이전 전파 실행의 비교용이다.
좌표 부분 수정 비교는 캐릭터 행에 `authoringMode: "pixel-patches-v1"`을 지정하고 `bulk --batch-size 1`로 실행한다.
기본은 기존 `grid` 저작이다. `pixel_ops.py`가 명시한 좌표·색만 적용하고 원본부터 명령을 다시 적용해 최종 격자와 12장 직접 수정 기록을 검증한다.
명령 기록은 `pixel-edits.json`, 게시 binding은 `model-frames.json.pixelEdits`에 보존한다. 걷기 합성·미감 선별은 추가하지 않는다.
현재 그림의 해시가 바뀌면 사람의 선택도 다시 확인한다. 사용자 선택·산출·원본은 `CHR_HARNESS_DATA` 아래 보존한다.
사람이 남긴 그림과 설명은 사용자 공용 SQLite의 `charset-actor-kept`에 자동 등록한다. 에디터를 새로고침하면 새/기존 프로젝트와 AI NPC 검색에서 쓴다.
폐기/되돌리기는 공용 목록에서 제외하고 기존 프로젝트 그림을 보존한다. 과거 모델 검수 모드는 이전 실행 재현용으로 유지한다.

명시적으로 새 몸 구조를 주문한 `noveltyPolicy` 실행은 `novelty.py`의 팔레트 독립 구조 비교와
`body_diversity.py`의 네 방향 정지 외곽 비교를 통과한 그림만 공개한다. 비교 기준/그림 해시와 입고 영수증을 보존하고
사람의 선택 기록을 대신 만들지 않는다. `original_monsters.py`는 전체 최대 6명의 native 작업자로 같은 slot의 실패를
최대 두 번 재저작하며 실제 납품한 고유 slot만 완료로 센다. 재배분은 `novelty-transfers.json`에 남겨 주문 수 중복을 막는다.
2026-10-06 사용자의 폐기 지시로 실패한 변주 100종을 공방·공용 SQLite에서 제거하고 서로 다른 몸/이동 지시 100개로 다시 시작했다.
원본 Monster 그림은 46개이고 입력 개수가 100개인 것은 아니다. 기존 URL에서 후속 새 후보를 확인한다.

상세 계약은 [캐릭터 하네스](../charset-actor-harness.md), 명령과 저장 구조는
[실행 지침](../../src/harnesses/charset-actor/README.md). 화면 http://mdc-server:18314/.

## 검증된 걷기 인물의 행동 포즈 (2026-10-06)

`npm run harness -- charset-actor actions produce REQUEST --out DIR`는 같은 하네스의
현재 `human_ready` 걷기 원본에 행동을 추가한다. 저장소는 `CHR_HARNESS_DATA`로 격리한다.
REQUEST는 source(path/sha256), palette, canvas, origin과 poses(id/direction/frames/durationMs/description)를 가진다.
원본 24×32의 접지는 (12,31)이며 출력 origin에 정렬한다. 머리와 발을 보존하고 팔/도구를 직접 저작한다.
원본 걷기·사람의 선택·기존 게시를 변경하지 않는다. 넓어진 행동 캔버스를 걷기 CharSet으로 설치하지 않는다.

`actions.px.json`은 공통 pixelgrid의 명시 행 문자열이다. 모델 종료 후 `actions check`가
팔레트·원점·시간·모든 행동 프레임·머리/발 화소 보존·행동 변경·잘림을 검사하고 PNG/GIF를 굽는다.
최대 두 번의 기술 수정은 이전 격자/검사/프롬프트/프로세스 결과와 함께 보존한다.
형식 통과는 동작 미감·몸의 해부학·실제 가구와 손의 접촉을 증명하지 않는다.
그림은 공간의 독립 검수와 Allow/Deny를 거쳐야 하며 새로운 픽셀을 자동 보간하지 않는다.

슈퍼하네스 `theme_actors.py`는 native 프로세스에서 현재 걷기 binding과 행동 receipt를 확인한다.
두 납품이 모두 있고 전용 테마·팔레트·원본/출력/도구 해시가 맞을 때만 전용 재료 coverage에 연결한다.
행동이 없는 걷기만으로 전체 인물 요구사항을 완료 처리하지 않는다.
