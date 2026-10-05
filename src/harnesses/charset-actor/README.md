# 캐릭터 GIF 공방

AI는 자유롭게 도트를 만들고 사용자는 걷는 GIF를 보며 **남기기 / 폐기**만 결정한다.
화면: http://mdc-server:18314/ · 기본 모델 **GPT 6.1 sol high**가 **정지 4장·걷기 8장 모두 직접 저작**한다.

## 지금 사용하는 자유 저작

```bash
npm run harness -- charset-actor produce --count 100
npm run harness -- charset-actor produce --count 100 --reference /absolute/reference.png --prompt '여러 장르의 개성 있는 인물'
npm run harness -- charset-actor serve --port 18314
npm run harness -- charset-actor export RUN
python3 src/harnesses/charset-actor/harness.py publish-shared
npm run harness -- charset-actor audit --run RUN --refresh-previews
npm run harness -- charset-actor walk-qa --run RUN --out /absolute/evidence-outside-repo
```

- `produce`는 manifest/작업 폴더를 만들고 터미널과 독립적으로 저작을 시작한다. `--par 4 --batch-size 2`가 기본이다.
- 기본 제작은 원본 ASCII 격자 편집으로 돌아간다(2026-10-04 사용자 피드백). 초기 PNG 첨부·남김/폐기 비교·추가 조형 지시를 자동으로 넣지 않는다. manifest에 `visualReferences: ["pixel-style-reference.png"]`를 명시한 실험만 원본과 실행 폴더 안 참고 최대 4장을 `--image`로 첨부한다. `visual-inputs.json`/후보 meta는 기본 `[]`, 실험은 첨부 순서·파일 SHA256을 기록한다. 경로 지시나 열람 선언만으로 이미지 입력을 증명하지 않는다.
- UI의 「새 캐릭터 만들기」에서 남긴 그림의 변주 또는 자유 저작을 고른다. 자유 저작의 전체 방향·참고 시트를 비우면 AI가 인물과 복식을 정한다.
- 모자·소품·장르·역할을 제한하는 미감 점수나 별도 Sonnet 심사는 없다. `free-worker.md`로 네 방향의 세 자세, 12장을 직접 그린다.
- `animationMode: model-12`인 새 제작은 모델 종료 0 뒤 정확한 제출 격자를 읽고 렌더한다. `model-frames.json`에 격자/원본/프레임별 RGBA 해시와 실제 변경 수·모델을 기록한다. 원본 그대로인 프레임은 납품 미완료다. `human_ready`는 이 기록의 현재 binding도 요구한다.
- 구조·빈 프레임·키 색 ±8·머리/몸체 투명 결손·위/옆 잘림 위험은 자동 차단한다. 머리 판정은 원본 머리 내부 면을 유지하는 사람형 검사이며 모든 해부학 오류를 알아내지는 못한다.
- 새 제작(`motionPolicy: 1`)은 `motion.py`로 몸통 중앙의 정지↔각 걸음, 두 걸음의 다리/발 교대를 나눠 검사한다. 실제 RGBA 변화와 alpha/색 경계 위치 변화 각각 최소 4px, 두 줄·두 열을 요구한다. 색만 바뀐 프레임·한 픽셀 깜빡임·정지 전체를 ±2px 이동한 복사는 걷기로 인정하지 않는다. 양쪽 걸음의 몸통이 같아도 정지 대비 정상 bob은 허용한다.
- 영역은 원본 정지 발끝 기준 몸통 중앙 7줄/하단 다리·발 5줄로 고정한다. 현재 24×32 사람형과 원본 비율 유지 계약에 한정한 결함 검사다. 해부학 분할이나 자연스러움의 증명은 아니다. `python3 src/harnesses/charset-actor/harness.py motion-check /absolute/out.chr.txt --base BASE`로 `views/motion.json/png/gif`를 남긴다. 화면 상세에서도 변화 비교와 느린 걷기를 볼 수 있다. 납품은 검사 구현·그림·원본·진단 아티팩트 해시에 묶인다.
- 옛 실행의 픽셀/사람 선택/납품 정책은 유지한다. 도구 변경 뒤에는 기존 봉인을 고쳐 재개하지 않고 같은 실제 남김에서 현재 계약의 새 기준을 만든다.
- 산출물은 `reviewMode: human`, `strength: free`. 작업자 종료 후 렌더와 `published.json` 해시가 일치하면 GIF 대기열에 올린다.
- 모든 탭에서 한 화면에 한 캐릭터만 표시한다. 위·오른쪽·아래·왼쪽 걷기와 칸 위 이동 GIF를 항상 함께 보여준다. 다음 후보의 GIF도 미리 불러온다.
- 걷기는 자홍색 체커 배경이 기본이다. 흰색·검정·잔디로 즉시 전환하여 투명 점·열린 틈과 배경색으로 위장한 옷을 확인한다. 상세 시트는 실제 RGBA를 보여준다.
- alpha 정책은 렌더/선택 binding과 따로 버전을 관리한다. 검사 개선 때 옛 PASS를 다시 계산하되 같은 픽셀의 사용자 선택을 지우지 않는다. 새 옷 안의 투명 구멍과 깊은 머리 면의 열린 틈도 차단한다.
- `audit --run RUN`은 저장소 밖 데이터 폴더에 전체 12프레임 접촉 시트와 세 배경의 원본/후보 비교, 결손 좌표·해시·PNG 키 색 재읽기 `audit.json`/`SUMMARY.md`를 남긴다. `--refresh-previews`는 같은 격자로 고대비 GIF/RGBA 시트만 추가하며 그림·사용자 결정·공용 DB를 바꾸지 않는다. 차단 후보의 원본/선택 이력은 보존하고 정상 후보 목록·새 팩·공용 게시에서 제외한다.
- `audit`는 모델 12장 직접 저작의 기록과 현재 격자 해시도 대조한다. `propagate`/`walk-qa`는 이전 전파 실행 재현용이며 모델 12장 후보에 대한 전파 호출은 거절한다.
- 남기기/폐기를 누르면 즉시 해당 카드가 사라지고 다음 캐릭터로 넘어간다. A/R과 방향키·이전/다음 버튼을 쓸 수 있다. 이유와 메모 입력은 필수가 아니다.
- `직전 선택 되돌리기`는 저장 응답을 기다리지 않고 해당 캐릭터를 검토 대기로 되돌린다. 보관한 캐릭터의 개별 되돌리기도 남김/폐기 탭에서 할 수 있다.
- 선택은 클릭 즉시 카드와 집계에 반영된다. 서버 저장은 뒤에서 순서대로 처리하며 `저장 중 N건`으로 표시한다. 실패하면 브라우저에 보관한 선택을 자동/수동 재시도한다.
- 새로고침과 두 탭의 연속 선택도 고유 선택 ID와 공유 전송 잠금으로 보존한다. 저장이 끝나기 전에는 다운로드를 기다린다. 그림 변경 등으로 서버가 선택을 거절하면 되돌려 다시 검토한다.
- 남김/폐기 탭에서 선택을 되돌릴 수 있다. 원본과 선택 journal은 보존한다. 결정은 본 격자·원본·강도·검사 버전에 묶이며 그림이 바뀌면 다시 선택한다.
- 「일시 정지」는 진행 중인 묶음을 마치고 다음 묶음부터 멈춘다. 「이어 만들기」는 없는 결과만 재개하며 공개된 GIF는 다시 굽지 않는다.
- 「남긴 캐릭터 다운로드」는 **실제 사람의 남기기 결정만** ZIP에 넣는다. 생성이 진행 중이어도 이미 남긴 캐릭터를 받을 수 있다.
- ZIP: 8명씩 288×256 CharSet PNG·RGBA·걷기 GIF·격자·선택 해시·출처/라이선스. PNG 색 키 ±8 처리를 다시 읽어 확인한다.
- 작업자 설명은 독립 관찰 심사가 아니다. 참고 시트 원본은 출처 문구까지 보존한다.
- 데이터는 `CHR_HARNESS_DATA`(기본 `~/.local/share/oprn/charset-actor-harness/`) 아래다. 새로운 사람의 선택과 accepted 사본은 저장소 밖에 둔다.
- 사람이 남긴 캐릭터는 PNG와 설명을 사용자 공용 SQLite에 자동 등록한다. 과거에 격리한 불량 후보를 자동 복구하지 않는다.

### 남긴 그림으로 같은 계열을 계속 만들기 (2026-10-04)

```bash
npm run harness -- charset-actor produce --creatures --count 100 --par 2 --max-review-pending 12
npm run harness -- charset-actor recipe --source-run RUN
npm run harness -- charset-actor produce --seed-run RUN --count 100 --par 2 --max-review-pending 12
npm run harness -- charset-actor produce --recipe RECIPE_ID --count 100 --par 2
```

화면 「새 캐릭터 만들기 → 남긴 그림으로 변주」에서도 실행별 남김을 기준으로 시작한다.
기준은 설명/장르 통계가 아니라 **현재 그림 해시에 대한 실제 사람의 남김**이다. 최초 기준을 만든 후에는
그 당시 원본·선택·작업 지시를 보존한 판본을 재사용하며, 현재 남김으로 갱신하려면 새 기준을 만든다.

- `recipes/ID`와 실행의 `recipe/`에 실제 남긴 12프레임·이전 원본·제작 지시·작업자 설명·명령 기록·모델/도구 SHA256을 보존한다. 입력 PNG는 축소/양자화 없이 같은 픽셀인지 다시 읽는다.
- 각각 남긴 그림의 저작 방식(`grid`/`pixel-patches-v1`)을 보존한다. 기존 `free-worker.md`/`pixel-worker.md`를 복사해 쓰며 초기 이미지 첨부와 취향 추론 지시는 추가하지 않는다. 원본이 이미 완성된 남긴 그림이고 짧은 변주 지시만 추가된다. 머리·옷·작은 장식 세부를 모델이 새로 정하며 모든 12장을 직접 저작한다.
- 한 작업자는 한 캐릭터만 제작한다. 모델/도구/봉인한 원본이 달라지면 조용히 다른 조건으로 재개하지 않는다. 새 기준이 필요하다고 실패를 기록한다.
- 납품 전에 `delivery.py`가 현재 12장 저작 기록·좌표 명령 재적용·투명 검사·PNG/RGBA·체커/흰색/검정/잔디 걷기 GIF를 실제 픽셀과 대조한다. 정지·두 걸음이 같은 그림, 설명 누락, 완전히 같은 픽셀의 중복 후보도 차단한다. **미감 점수/추정 취향/통계적 품질 개선 판정은 아니다.**
- 기술 실패만 동일 모델이 최대 두 번 직접 수정한다. 매번 프롬프트/로그/수정 전 격자/실패 좌표를 `attempts/`에 남기고 픽셀을 Python으로 자동 보정하지 않는다. 다 고치지 못한 결과는 `failure.json`/생산 오류에 보존하고 공개하지 않는다.
- 납품 증거는 `delivery.json`에 묶는다. 공개 후 GIF·원본·설명·저작 기록이 바뀌면 다시 납품하기 전에는 선택/팩/공용 게시 대상으로 쓰지 않는다.
- 검토 대기와 진행 중 예약의 합은 `--max-review-pending`(기본 12)을 넘지 않는다. 대기열이 차면 `waiting-review`, 실제 남김/폐기가 저장되면 다음 캐릭터를 시작한다. 일시 정지/재개는 동시 작업 수를 보존하고 이미 공개한 그림을 덮지 않는다.
- ZIP에는 제작 기준과 원본 계보도 보존한다. RTP에서 파생한 그림을 남긴 뒤 다시 변주해도 원본 RTP 라이선스가 빠지지 않는다.

첫 실제 생산: `20261004-215234-kept-f3cdab75` · 직전 실험에서 남긴 4명 → 100명 대기열,
동시 2명·한 작업자 1명·검토 대기 최대 4명. 기계 통과는 새로운 변주의 미감 합격을 뜻하지 않는다.

### 에디터 공용 라이브러리

현재 남김은 `~/.local/share/oprn/shared-content.sqlite`의 `charset-actor-kept`에 저장하고 같은 행을 재읽는다.
API 시작과 선택 저장 뒤 자동 등록하며 위 `publish-shared` 명령으로도 복구할 수 있다.
저장 실패는 화면의 재시도 상태에 남는다. 선택 journal은 보존되므로 같은 선택의 재전송으로 복구한다.

에디터를 새로고침하면 새 프로젝트와 기존 프로젝트, 시스템 → 캐릭터·얼굴, NPC 그림 선택, AI의
`list_npc_graphics`/`list_resources(kind:"charset")`에서 이름·직업·의상을 검색한다.
캐릭터별 고정 ID와 RM2000 0번 칸을 사용하여 선택 변경이 이미 배치한 NPC의 그림을 바꾸지 않는다.
폐기/되돌리면 공용 검색에서 빠지고 이미 프로젝트에 복사한 그림·이벤트는 보존한다.

설명 원문·원본 참고 PNG·칸·선택 해시·라이선스도 같은 라이브러리에 보존한다. 업로드 그림과 생성 픽셀을 Git/public에 넣지 않는다.
새 작업자는 나이 설정·머리·의상을 `desc.json.attributes`로 저작한다. 설정하지 않은 나이는 불명이며 옛 결과에서 추정하지 않는다.
격리 확인용 서버는 `CHR_HARNESS_DATA` **및** `OPRN_SHARED_CONTENT_SQLITE`를 임시 경로로 지정해야 한다.

`studio.py`는 생성/재개를 저장 대상 잠금으로 직렬화하며 `driver.json`, `production-state.json`, `production.log`에 진행과 실패를 남긴다.
`bulk.py`의 외부 manifest도 각 행에 `reviewMode: "human"`, `strength: "free"`를 넣으면 같은 자유 저작 계약을 사용한다.
그 경우 최상위 manifest에도 `reviewMode: "human"`을 넣어 내보내기에서 사람 선택만 사용하게 한다.

## 선택 저장과 공용 등록 (2026-10-05)

`serve`의 현재 진입점은 `review_server.py`다. 봉인된 도트 저작 도구와 HTTP 동기화를 분리하여
제작 중인 모델/12프레임/원본/납품 해시를 유지한 채 화면을 고친다. `harness.py serve`는 이전 실행용이다.

- 선택은 후보의 현재 binding과 기술 적격성을 확인하고 journal을 fsync한 뒤 응답한다. 공용 등록 실패는 저장한 선택을 되돌리지 않는다.
- 공용 SQLite 등록과 accepted 사본 복구는 단일 작업자가 뒤에서 묶어 처리한다. 동시에 새 선택이 들어오면 최신 journal로 이어 등록한다.
- 동일 mutation의 재시도는 같은 영수증을 반환하며 옛 남기기 재시도가 뒤의 폐기/되돌리기를 복원하지 않는다.
- 목록 검사는 입력/그림/납품/원본/모델 종료가 바뀔 때 한 작업자만 갱신한다. 선택과 생산 상태는 매 조회에 다시 읽으며 남기기 시 기술 검사는 현재 파일로 수행한다.
- 다운로드는 선택 목록만 잠금 안에서 복사하고 패킹은 별도 잠금으로 진행한다. 다운로드 중에도 선택을 저장한다.
- 숨은 탭은 주기 조회를 쉬며 GIF 로드 전에는 버튼에 대기 상태를 표시한다. 공용 등록 중/실패/재시도는 journal 저장과 따로 보여준다.
- 서버의 legacy 내보내기/사본도 저장소 밖 `decisions-export.json`/`accepted-legacy/`에 둔다. 기존 기록과 원본을 덮지 않는다.

별도 저장소의 3탭 브라우저에서 공용 등록을 6초 늦춘 상태로 연속 남기기/폐기, 되돌리기와 옛 재전송,
재접속, 숨은 탭, SQLite 재로드를 확인했다. 카드 이동 53~95ms, 저장 응답 91~298ms,
동시 목록 조회 37~43ms, 브라우저 오류 0이었다. 이 값은 확인용 저장소의 측정이며 실제 서버 측정은
`evidence/review-save-20261005/live-state-proof.json`에 별도로 보존한다.
자동 CI의 `verify_review_server.py`는 journal 재읽기/중복/해시 변경/등록 지연·실패·재시도 계약을 확인한다.
이 세션에서 전체 테스트/게이트를 직접 실행하지 않는다.

## 선택적인 좌표 저작 비교 실험

`bulk` manifest의 캐릭터에 `authoringMode: "pixel-patches-v1"`을 넣으면 `pixel-worker.md`를 사용한다.
생략하거나 `"grid"`이면 기존 `free-worker.md`를 그대로 사용한다. 비교 실행은 `--batch-size 1`로 방법별 작업 폴더를 분리한다.
두 방식 모두 GPT 6.1 sol high가 정지·걷기 12장을 직접 저작하며 초기 이미지 첨부는 기존 opt-in 계약을 따른다.

`pixel_ops.py inspect GRID --frame down 1`은 현재 SHA256·팔레트·좌표를 보여준다.
작업자는 `{version:1, sourceSha256, palette:{Z:"#704028"}, ops:[{frame:"down 1",x:8,y:18,pixels:"ZZZ"}]}`
형식의 JSON을 직접 작성하고 `pixel_ops.py apply GRID PATCH.json`으로 해당 픽셀만 적용한다.
`before`로 기존 글자열도 확인할 수 있다. 범위 초과·없는 색·투명 키 색·옛 해시를 거절하며 자동 전파·구멍 채우기는 하지 않는다.
원본을 그대로 복사한 `out.chr.txt`에서 시작하고 `pixel-edits.json`에 모든 명령과 해시를 보존한다.
`pixel_ops.py verify GRID`는 원본부터 명령을 재적용해 최종 격자와 바이트 단위로 대조하고 12장 모두 직접 수정했는지 확인한다.
모델 종료 뒤 동일 검사를 수행하여 `model-frames.json.pixelEdits`에 결부한다. 기록 없는 직접 덮어쓰기는 게시하지 않는다.

2026-10-04 첫 실험은 같은 원본·콘셉트 3쌍, 총 6명이다. 방법 이름은 검토 카드에 추가하지 않고,
짝과 순서는 저장소 밖 실행 폴더의 `experiment.json`에 보존한다. 기술 검사를 통과한 실제 GIF의 남김/폐기는 사람이 결정한다.
3쌍 결과만으로 일반적인 품질 향상을 주장하지 않는다. 업로드 원본·후보·선택은 Git에 넣지 않는다.

## 이전 지시 기반 저작과 독립 모델 검수

아래는 기존 실행을 재현하는 절차다. 자유 저작의 현재 선택 계약은 위 절을 따른다.


RPG Maker 2000 CharSet 캐릭터 한 명(72×128 = 24×32 프레임 3장 × 방향 4개)을 만든다.
**생성 이미지는 쓰지 않는다.** 작업자 모델이 격자 글자(`.chr.txt`, 한 글자 = 한 픽셀)를 직접 고치고, 하네스가 PNG·GIF 로 굽는다.
뼈대는 `public/assets/easyrpg/charset/Actor1.png` 의 한 명 — 몸 비율·걸음 동작은 그대로 두고 머리 모양·옷·색·소지품을 바꾼다.
**고르는 건 사용자다.** 감독(세션 에이전트)은 후보를 나란히 보여 줄 뿐, 대신 판정해 번들·맵에 넣지 않는다.

## 여러 캐릭터를 한 번에 저작하기

`bulk.py`는 저장소 밖 manifest의 `characters`를 최대 8명씩 나누고, 묶음마다 독립 작업 폴더에서
GPT 6.1 sol high를 실행한다. 정지·걷기 12프레임 직접 편집 → 제출 기록/그림 렌더 → Sonnet medium 독립 검수와 관찰 설명을 저장한다.
시각 검수 FAIL을 이유로 재저작하지 않는다. 다시 실행하면 그림과 검수가 없는 작업만 진행한다.

```bash
python3 src/harnesses/charset-actor/bulk.py /path/to/manifest.json --par 6 --batch-size 8
python3 src/harnesses/charset-actor/bulk.py /path/to/manifest.json --par 2 --batch-size 4 --detach
python3 src/harnesses/charset-actor/bulk-export.py RUN
python3 src/harnesses/charset-actor/bulk-export.py RUN --discard-failed  # 제외 결과를 공개 후보에서 버린다
```

manifest 형식: `{run, characters:[{key,name,base,gender,genre,role,age,brief,keep,strength,source}]}`.
`source: "upload"` 파생 원본·PNG·설명·팩은 `CHR_HARNESS_DATA` 아래에 보존한다.
`runs/RUN/_batches/` 아래 작업 폴더를 실행 루트에 심링크로 연결하여 기존 비교 화면에 게시한다.
`--detach`는 터미널과 독립된 드라이버를 띄우고 `driver.json`·`production.log`를 남긴다.
이미 실행 중인 작업자는 재실행하지 않는다. 실행 단위 잠금으로 생산과 내보내기가 겹치지 않게 한다.
`/?run=RUN&view=grid&show=all`에서 전원 모아 보기, 장르 필터, 이름·관찰 외형·태그 검색을 사용한다.

내보내기는 최신 기계 검사 통과 + 독립 시각 PASS인 결과만 8명씩 288×256 CharSet에 패킹한다.
RTP 파생물이 있는 팩은 원본의 `AUTHORS.md`와 `COPYING`도 `licenses/easyrpg/`에 함께 넣는다.
사용자 버림·미검수·결손은 제외한다. 직접 받은 결과는 비치명적 시각 지적만 예외로 할 수 있으며 결손은 예외가 없다.
모델/effort·중복·구조도 확인한다. 실패는 재저작하지 않는다.
각 칸을 파일에서 다시 읽어 원래 RGBA 그림과 대조하고 마지막 시트의 빈 칸도 확인한다.
ZIP에는 검수를 통과한 사람의 PNG·투명본·관찰 카탈로그·격자·출처와 로컬 등록 API용 자산 팩이 들어간다.
기존 팩은 공개 `runs/` 밖 `quarantine/<RUN>/exports/`로 옮기고 빈 폴더에서 새 팩을 만든다.
`--discard-failed`는 제외한 결과도 `quarantine/<RUN>/characters/`로 옮긴다. `discarded.json`은 재개 시 재생산을 막는다.
ZIP을 풀고 `index.html`을 열면 서버 없이 검색과 네 방향 걷기를 확인할 수 있다.
내보내기로 사용자 결정을 변경하거나 에디터 프로젝트/공용 자산에 자동 등록하지 않는다.

## 흐름
```
brief(harness-data/charset-actor/briefs.json) ── 뼈대 번호 + 만들 캐릭터 + 지킬 것
   │
draw ── 작업자(엔진별 1명, 같은 지시) — Claude Sonnet 5.5 medium · Opus 5.5 high(`claude -p`) · GPT 6.1 sol high(`codex exec`)
   │    수정 작업: `--src` 로 다른 작업자 결과에서 시작, `--fix-notes` 의 감독 지적을 고친다
   │    작업자는 check(기계 검수) · views(8배 시트·필름 띠) 를 스스로 돌리며 고친다
   ▼
page ── 엔진별 결과를 뼈대 원본과 나란히: 걷기 GIF·돌기 GIF·칸 위를 걷는 GIF·1배·8배·필름 띠·기계 검수
   │    → http://mdc-server:18301/charset-actor-<실행>.html
사용자 판정
```

## 고치기 루프 (`loop`) — GPT 가 고치고 Sonnet 이 검수한다 (2026-10-02 사용자 지시)
```
r1: drawer(기본 gpt) 가 뼈대에서 그린다 → reviewer(기본 sonnet medium) 가 판정 → verdict.json
r2..: 불합격이면 직전 판의 out.chr.txt 에서 시작해 검수자 지적(issues·good)을 고친다 → 다시 판정
멈춤: 검수 PASS(high·mid 지적 0, 점수 ≥8) 또는 --rounds(기본 1)
```
**기본은 원샷(1판)이다.** 2026-10-02 남·여 4판 실험(기사 5→6점, 약초사 4→5점, 8판 전부 FAIL) 뒤 사용자 판단:
「원샷에 바꿔놓는 게 제일 낫다」. 고치기 판은 같은 지적을 국소 수정으로 반복할 뿐 핵심 형태를 못 바꿨다.
검수자는 그대로 돌려 판정·지적을 화면에 붙인다(사용자 판단 자료). 반복이 필요하면 `--rounds N` 을 명시한다.
검수자는 작업자의 notes.md 를 받지 않는다(그림·기계 검수·지시만). 기계 검수가 막으면 검수자 판정과 상관없이 FAIL.
검수자 지시문 `reviewer.md`, 검수자가 보는 그림 `strip.png`·`base_strip.png`·`sheet_x8.png`·`context.png`(Actor1 네 명 옆에 세움).

## 얼굴 (48×48 FaceSet) — `faces --run R` 또는 `loop` 끝에 자동(`--face sonnet`)
뼈대는 같은 번호의 Actor1 얼굴(`public/assets/easyrpg/faceset/Actor1.png`, 칩 n번 ↔ 얼굴 n번 — `sharedCharacterGraphics.json`).
원본은 125색이라 64색으로 줄여 꺼낸다(`chr.from_faceset`, 눈으로는 차이 없음). 작업자는 완성 칩을 보고 머리·색·장신구만 고친다(`face.md`).
결과 `<작업 폴더>/face/out.face.txt`·`face/views/{face,face_x4,compare}.png`. 기계 검수: 48×48, 색 ≤90, 뼈대 얼굴과 ≥15% 다름.
흉상·전신은 아직 없다 — 공용 흉상·전신(`public/assets/shared/portraits/`)은 1000px 생성 그림이라 뼈대로 쓸 수 없다(생성 이미지 금지).

**얼굴은 생성으로 (2026-10-02 사용자 결정 — 칩은 계속 손 도트, 얼굴만 예외)** `gen-faces --run R [--redo]`:
- v1(폐기): [Actor1 원본 얼굴 | 새 칩]을 주고 「이 캐릭터로 다시 그려라」 → 사용자 「얼굴이 너무 많이 바뀐다, 각도까지 꽉 하네싱」.
  18명 모두 각도·구도·얼굴 크기가 바뀌었다(각도 점수 -0.01~0.47).
- v2: 손 도트 얼굴(`faces` 결과 — 원본과 픽셀 골격이 같고 머리·색만 바뀐 것)을 정사각 그대로 참고로 주고
  「손질만, 각도·눈코입 위치·구도·배경은 잠금」(`gen_face.PROMPT_LOCK`). 그래서 **손 도트 얼굴이 먼저** 있어야 한다.
- 각도 점수 `gen_face.pose_score`: 손 도트가 원본에서 손대지 않은 칸(= 얼굴 골격, `kept_mask`)에서 생성 결과와 원본의 밝기 구조 상관.
  `POSE_MIN`(0.65) 이상이 나올 때까지 최대 3번 다시 뽑고 가장 높은 것을 쓴다. 점수·시도는 `face_gen/meta.json`, 화면에도 표시.
  → 각도는 지켰지만 손 도트를 다듬는 데 그쳤다. 사용자 「많이 바꿔도 괜찮다, 보는 각도만 유지한다면」.
- **v3(지금, `PROMPT_FREE`)**: 같은 참고 그림(손 도트 얼굴 한 장)에 생김새·머리·표정·피부·옷은 자유, 고개 방향·회전량·기울기·시선·구도만 잠금.
  판정은 **각도 전용 검수자** `gen_face.judge_angle`(Sonnet 5.5 medium, 원본 얼굴과 후보 두 장만 보고 JSON) — 같은 방향이고 `ANGLE_MIN`(7/10) 이상일 때까지
  최대 3번. 골격 점수(v2)는 참고로만 `tried[].pose` 에 남긴다. 이전 판은 `face_gen_<판>/` 으로 옮겨 둔다.
  참고 그림에 칩을 나란히 넣으면(v1) 다시 그려서 각도가 무너진다 — 참고 그림은 얼굴 한 장만.
  생성은 줌아웃돼 머리가 작게 나오기 쉽다(첫 v3 18명 중 9명이 「머리가 작다·어깨가 보인다」로 6점 이하) → `gen_face.align_crop` 이
  원본과 골격 상관이 가장 높은 확대(1.0~1.6)·위치(±18%)를 찾아 48×48 로 자른다. 그 뒤 18명 전원 7~8점(새로 뽑은 것 8장).
  `gen-faces --reuse` = 이미 뽑은 raw 를 다시 자르고 다시 판정, 모자라면 새로 뽑기.
- API 는 흉상·전신 파이프라인과 같은 `MDC_IMAGE_API`(god-tibo-imagen, 참고 그림 한 장·마스크 없음). 1024 → 48×48 LANCZOS + 96색.
- 화면은 생성 얼굴을 크게, 손 도트 얼굴을 작게 함께 보여 준다. `face_gen/compare.png` = [원본 | 손 도트 | 생성 | 칩].

## 받기/버리기 화면 (`serve`, 18314)
http://mdc-server:18314/ — 비포(Actor1 원본 걷기·돌기·시트·얼굴)와 애프터를 위아래로 나란히. 모든 실행의 완성본을 걷기·돌기·칸 위 걷기 GIF, Actor1 옆에 세운 그림, 검수자 판정(참고용)과 함께 보여 준다.
`A` 받기 · `R` 버리기(이유 칩 + 메모, `Enter`) · `↑↓` 이동. 결정의 정본은 `~/.local/share/oprn/charset-actor-harness/decisions.jsonl`(추가만),
결정마다 `harness-data/charset-actor/decisions.json` 사본과 `accepted/<폴더>__<실행>.chr.txt`·`.png`(받은 것만)를 다시 쓴다.
서버는 사용자 유닛(transient) — 죽었으면:
```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u) DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus
systemd-run --user --unit=charset-actor-harness -p Restart=on-failure /usr/bin/python3 <체크아웃>/src/harnesses/charset-actor/review_server.py --port 18314
```

## 지시문 쓰는 법 — 실루엣은 뼈대 그대로 (2026-10-02 사용자: 「무기나 모자 추가는 별로」)
판정 34개를 실루엣 변화량과 맞춰 보면 받은 11개 중앙값 47px, 버린 23개 중 19개가 140px 초과(무기·모자·날개·지팡이를 더한 것).
그래서 지시문은 **같은 실루엣의 다른 사람** — 머리색·옷 색 구성·안쪽 무늬·피부 톤만 바꾼다. 소지품·모자·두건·날개를 더하라고 쓰지 않는다.
`worker.md` 규칙 6, 기계 검수(뼈대 실루엣 밖 돌출 — 아래 「걸음 전파」 절), 생성 얼굴도 모자·장신구 추가 금지(`PROMPT_FREE`). 예: briefs 의 `c-*`.

## 이전 걸음 전파 — 현재 제작은 모델이 12장 모두 저작 (2026-10-02 계약 기록)
색만 바꾼 판(c-*)은 실루엣 0px 로 「너무 비슷하다」. 더 바꾸면 손으로 그린 걸음이 어긋난다 → `chr.propagate`:
출렁임을 보정한 같은 자리의 원본 색이 같으면 새 그림도 그 자리에서 가져온다. 원본 색이 달라 실제 움직임 대응이 필요한 픽셀만 3×3 무늬 대조(±3px)로 출발 자리를 찾는다.
근처에 같은 색이 없으면 같은 방향의 서 있는 자세 전체에서 무늬를 대조한다(올린 그림의 칼·창은 한 걸음에 3px보다 멀리 움직이기도 한다).
서 있는 자세 어디에도 없는 색(걸음에만 있는 그림자)만 뼈대 색→새 색 대응표를 쓴다. 대응표에서 투명으로 지운 색은 그대로 투명으로 둔다.
뼈대에 없던 새 픽셀(머리 볼륨)은 출렁임만큼 내려 옮긴다.
원본 72명을 자기 자신으로 전파하면 걸음 프레임이 100% 그대로 나온다. 원본 걸음은 576장 중 572장이 「서 있는 자세 1px 아래」이고,
같은 자리 그대로인 비율은 머리 82%·몸통 25%·다리 12% — 몸통·다리는 대응 찾기가 필요하다.
당시 `loop`는 작업자 뒤 전파했다(`out.worker.chr.txt`). 현재 `loop`는 모델 12장을 그대로 렌더한다. 수동 `propagate F --base K`는 이전 후보 재현용이며 새 모델 12장 후보에서는 거절한다.
소지품 검사도 바꿨다: 실루엣 변화 총량 대신 **뼈대 실루엣+2px 밖으로 튀어나온 픽셀**(프레임당 ≤10·합 ≤60). 판정 55개에서 받은 21개는
프레임당 ≤9, 소지품을 더해 버린 것은 11~42. 머리 모양·옷깃은 바꿀 수 있다. 지시 예: briefs 의 `v-*`.

## 뼈대 칩셋 — Actor1~4 · People1~5 (2026-10-02 「actor1 말고 다른 것들도」)
지시문 `base` 는 `"People3:7"` 처럼 칩셋:번호(0부터, 옛 정수는 Actor1). 짝 얼굴은 정본 `src/assets/sharedCharacterGraphics.json` 에서
RTP 얼굴(`easyrpg-faceset-*`)이 짝인 경우만 쓴다 — 72명 중 59명. 짝 얼굴이 생성 그림(`generated-faceset-*`)인 13명은 얼굴 단계를 건너뛴다.
`loop` 는 칩 → 검수 → 손 도트 얼굴 → 생성 얼굴(v3)까지 한 번에 간다(`--no-gen-face` 로 끔).

## 그림 넣어 고치기 + 수정 강도 (2026-10-03 「이런 거 약간 수정해서 쓰는 방향도… 약함·보통·강함」)
화면 왼쪽 위 「그림 넣어 고치기…」 또는 `ingest IMG --strength weak,normal,strong --go`. CharSet(72×128 한 명 / 288×256 여덟 명)을 받아
배경(왼쪽 위 픽셀 색, 투명이면 KEY)을 맞추고 `~/.local/share/oprn/charset-actor-harness/inputs/<id>.png` 로 둔다. 뼈대 키는 `input:<id>:<칸>`.
캐릭터가 있는 칸(1000px 이상)마다 × 고른 강도마다 지시가 하나씩 생긴다(`briefs-local.json`, 저장소 밖 — 남의 그림일 수 있다).
지시문은 비워도 된다 — 작업자가 강도 안에서 어떤 사람인지 정한다. 올린 그림은 짝 얼굴이 없어 얼굴 단계를 건너뛴다.
받은 것도 저장소가 아니라 `~/.local/share/oprn/charset-actor-harness/accepted/` 로 간다.

변형 작업자는 **GPT 6.1 sol · high**(`gpt-6.1-sol`, `model_reasoning_effort="high"`)다(2026-10-03 사용자 변경 지시).
화면 업로드와 CLI `ingest --go`·`loop`의 기본 작업자가 같다. 검수·설명은 Sonnet 5.5 · medium이다.

| 강도 | 작업자 규칙(`STRENGTH_RULES`) | 기계 기준(`chr.STRENGTH`) |
|---|---|---|
| 약함 | 모양 그대로 색만(머리색·옷 색·작은 무늬) | 실루엣 변화 합 ≤30px · 튀어나온 픽셀 0 · 원본과 ≥15% 다름 |
| 보통 | 머리 모양·옷 모양과 무늬, 새 소지품 금지(지금까지의 v-* 규칙) | 튀어나옴 프레임당 ≤10 · 합 ≤60 · ≥20% · 다시 찍은 픽셀 ≥15% |
| 강함 | 머리·옷 형태를 크게, 작은 장신구 허용, 큰 무기·날개 금지 | 튀어나옴 ≤20 · 합 ≤160 · ≥30% · 다시 찍은 픽셀 ≥25% |

「다시 찍은 픽셀」(`chr.redrawn`) = 뼈대 글자마다 가장 많이 옮겨 간 새 글자 하나로 색을 바꿨다고 보고, 그걸로 설명되지 않는 픽셀 비율.
첫 「보통」 조선 병사가 팔레트만 바꾸고 1분 만에 끝내서(0.02) 넣었다. 기존 판정 자료: 색 바꾸기 c-* 0~0.09, 받은 v-* 0.14~0.51.

세 강도 모두 현재는 정지·걷기 12장을 직접 저작한다. RTP 밖 그림은 절대 울타리(48색·24×31·480px)를 넘을 수 있어서(조선 병사 55색,
깃털이 칸 끝까지) 뼈대가 이미 넘은 만큼은 허용한다. 색이 48개를 넘는 뼈대는 원래 색 수 +4개까지 허용한다.
`--strength` 는 `check`·`views`·`propagate` 에도 있다.

### 2026-10-03 재개: 걸음 전파 보완

조선 병사 보통·강함의 마지막 결과는 시각 검수에서 각각 6점·4점 FAIL이었다. 걸음 전파의 먼 이동 대응과 투명 삭제를 보완했다.
원래 실행·판정·결정은 보존하고 `runs/20261003-propagation/` 에 기존 서 있는 자세에서 다시 전파한 비교본을 둔다.
시각 검수 점수는 다시 받지 않았으므로 이전 점수를 새 비교본에 복사하지 않는다. 그림 근거는 저장소 밖
`~/.local/share/oprn/charset-actor-harness/evidence/20261003-propagation/` 에 있다.
머리·옷의 방향 일관성, 남겨 둔 소지품의 가독성은 별도 저작·검수 과제로 남는다. 상세 계약은 `openwiki/charset-actor-harness.md`.

## 설명 (`desc.json`) — 조수가 NPC 를 고를 때 읽는다 (2026-10-03)
`loop` 끝에 Sonnet 이 그림만 보고(`sheet_x8.png`·`strip.png`·생성 얼굴) `describe.md` 형식으로 쓴다: `label`·`gender`·
`attributes{kind, age, hair}`(정본 `sharedCharacterGraphics.json` 과 같은 칸)·`role`·`appearance`·`colors`·`tags`·`fits`.
지시와 그림이 다르면 그림대로 쓴다. 이미 있는 것은 `describe --accepted`(받은 것만) / `describe --run R` 로 채운다.
받으면 `accepted/<stem>.json` 에 설명·뼈대·강도·파일 이름이 같이 나간다 — 번들 등록 단계의 원본.

## 기계 검수 (`chr.gate`) — 형식과 치명적 픽셀 결손
처음엔 Actor1 8명에서 잰 고정 기준이었는데 다른 칩셋 원본 64명 중 44명을 떨어뜨렸다(색 있는 윤곽선·47색·2px 출렁임·아이 몸).
지금은 넓은 절대 울타리 + **뼈대 원본 대비** 기준이고, `calibrate` 가 RTP 원본 72명 전원 통과를 확인한다.
절대: 색 ≤48 · 배경 키 색 금지 · 실루엣 120~480px · 크기 ≤24×31 · 걸음 0·2 의 다리가 다름 · 걸음 0↔2 바뀐 픽셀 ≥50 · 걸음 ≠ 서 있는 자세.
뼈대 대비: 프레임마다 실루엣 0.7~1.5배 · 어두운 윤곽 비율이 뼈대보다 15%p 넘게 떨어지지 않음 · 머리 출렁임 ≤ max(1, 뼈대) ·
걸음 동작 ≥ 뼈대의 60% · 뼈대와 다른 픽셀 ≥20%(복사 방지). 경고: 한 프레임에만 나오는 색(깜빡임), 실루엣이 원본과 같음(색만 바꿈), 발끝 줄 어긋남.

검사 v2(2026-10-03 사용자 불량 지적)는 12장 모두에 아래 폐기 조건을 적용한다.
- 4방향 flood fill에서 배경과 연결되지 않는 투명 구멍 중 원본 몸체를 삭제한 픽셀. 원래 투명한 손/다리 사이 공간은 제외한다.
- 원본 상반부의 가장 큰 채워진 직사각형 안쪽(머리 면) 20% 이상·최소 4px 삭제.
- 위/옆 프레임 경계의 새 픽셀(잘림 위험), 편집기 키 색 `#009392` 각 채널 ±8 범위의 몸체 색.

`discard`와 `fatal`은 점수·사용자 받기보다 우선한다. API 받기/받은 칩 복사/내보내기가 모두 차단한다.
`gate.json`을 검사 버전·격자 SHA256·원본 SHA256·강도에 결부하고 바뀌면 다시 검사한다.
이 검사는 해부학을 모두 이해하지 않는다. 열린 틈·방향별 머리 잘림은 독립 시각 검수에서도 먼저 확인해 `discard: true`로 기록한다.

100종 실행을 v2로 다시 확인한 결과 투명 결손 50종, 그 밖의 시각 FAIL/사용자 버림 46종을 제외했다.
공개 후보/팩에는 016·024·048·094의 4종(48프레임·CharSet 1장)만 남았다.
이전 「형식 100종 통과」는 v1 기록이며 폐기했다. 새 팩은 `mixed-rpg-validated.zip`; 이전 ZIP 링크도 같은 검수 팩으로 연결한다.
원본 RTP 72명과 업로드 원본 3명은 자기 자신 대비 통과했고, 실제 첨부 002와 결손 예시는 폐기됐다.
근거는 데이터 폴더 `evidence/20261003-quality-cull/`에 보존한다.

### 검사 v3와 생산 재개 (2026-10-04)

- 시각 판정 `inspected`와 렌더 `render.json`에 격자/원본 SHA256·강도·검사 버전을 묶는다.
  그림이 바뀌면 옛 PASS/옛 PNG로 받기나 내보내기를 못 한다. 갱신 대기는 불량으로 영구 폐기하지 않는다.
- 독립 검수는 매번 새 폴더에서 실행하고 exit 0을 요구한다. 오래된 results.json을 재사용하지 않는다.
- 동일 RGB의 다른 글자를 정규화해 가짜 걸음/재저작 수치를 막는다.
- 배치 크기·심링크 대상을 고정한다. 최초 작업자 격자는 한 번만 보관한다. 기존 loop 결과를 덮어쓰지 않는다.
- 내보내기는 고유 임시 ZIP을 쓰고, 폐기 이동 전에 pending 기록을 원자적으로 저장한다. 중단 후 재개도 이 기록을 따른다.
- 집중 확인: `python3 src/harnesses/charset-actor/verify.py --output /path/to/evidence.json`.
  RTP 72명과 결손/색 키/문자 별칭/걸음 옷 색/판정·렌더 갱신/중복 실행/생산 중단/패킹/폐기 재개의 94개 항목을 확인한다.
  모델 API·실제 사용자 결정·프로젝트 DB는 호출하지 않는다.

기존 4종은 같은 픽셀을 새로운 시각 계약으로 재검수했을 때 5·5·7·7점 FAIL이었다.
직업 표식 누락과 옷 형태 가독성 지적이므로 기존 100종 팩에는 현재 합격이 없다. 예전 점수를 유지하지 않는다.
새 실행 `20261004-character-continuation-pilot`은 8종 모두 기계 검사에 통과했으나 시각 검사에 탈락하여 후보에서 제외했다.
이어 `20261004-character-population-12` 12종을 검사해 1종만 통과시켰고, `20261004-character-population-88`로 88종을 더 저작한다.
전체 100종의 합격 수는 두 실행의 최신 `export-readback.json`으로 확인한다. 제작 수를 합격 수로 사용하지 않는다.
머리·얼굴·목 alpha 보존과 함께 옆모습의 연결된 옷 면, 깃/허리 경계, 걸음 전파 뒤 잡티 확인을 저작 지침에 추가했다.
작업자 GPT 6.1 sol high, 독립 검수 Sonnet medium, 시각 FAIL 뒤 자동 재저작 금지는 유지한다.
전파의 무늬 탐색이 고정된 몸통 위치에서도 옆 칸을 가져와 옷 색을 섞던 결함을 수정했다. People1:1의 조끼 예시에서 확인한 걸음 픽셀·서 있는 그림 보존·원본 걸음 보존을 확인 항목에 넣었다.

## GIF 는 사람용, 필름 띠는 모델용
모델 이미지 입력은 대개 GIF 의 첫 장만 본다. 그래서 AI 쪽 검수(작업자 자기 검수·이후 붙일 독립 검수자)는
`strip.png`(방향마다 원본 | 0 | 1 | 2 | 1 | 0↔2 차이 빨강)와 `sheet_x8.png`(4px 격자선)로 하고, GIF 는 사용자 화면에만 쓴다.

## 명령
```bash
H=src/harnesses/charset-actor/harness.py
python3 $H calibrate                                 # 기계 검수가 Actor1 8명을 통과시키는지
python3 $H draw hunter --engine sonnet --run R       # 백그라운드 작업자(최대 60분, CHR_HARNESS_TIMEOUT)
python3 $H draw hunter --engine gpt --run R
python3 $H status --run R
python3 $H loop knight-boy herbalist-girl --run R   # 원샷 그리기 + 검수(캐릭터마다 병렬). 반복은 --rounds N
python3 $H page --run R                              # 비교 화면
python3 $H check F.chr.txt --base 0 / views F.chr.txt OUT --base 0 [--strength weak]
python3 $H ingest soldier.png --name "조선 병사" --strength weak,normal,strong --go   # 올린 그림을 뼈대로
python3 $H describe --accepted                       # 받은 것에 설명 채우기
```

## 파일
| 파일 | 하는 일 |
|---|---|
| `harness.py` | 명령들, 작업자 실행(`claude -p` / `codex exec`), 비교 화면, 받기/버리기 서버 |
| `web/index.html` | 받기/버리기 화면 |
| `reviewer.md` | 검수자 지시문 틀 |
| `face.md` | 얼굴 작업자 지시문 틀(손 도트) |
| `describe.md` | 설명 작성자 지시문 틀(desc.json) |
| `gen_face.py` | 생성 얼굴 — 참고 그림·프롬프트·48×48 축소 |
| `chr.py` | `.chr.txt` 읽기·쓰기, Actor1 → 격자, 기계 검수, 시트·필름 띠·GIF 3종 |
| `worker.md` | 작업자 지시문 틀(절대 규칙: 생성 이미지·외부 그림 금지, 모양은 격자를 직접 고쳐서) |
| `fixer.md` | 수정 작업 덧붙임 — `draw --src <다른 작업 폴더> --fix-notes <감독 지적>` 이면 그 결과에서 시작해 지적을 고친다 |
| `harness-data/charset-actor/briefs.json` | 만들 캐릭터 목록 |
| `harness-data/charset-actor/lawn16.png` | GIF 바닥 잔디(정글 칩셋 잔디 칸) |

실행 산출물은 저장소 밖 `~/.local/share/oprn/charset-actor-harness/runs/<실행>/<brief>__<엔진>/`
(`prompt.md`·`worker.log`·`out.chr.txt`·`notes.md`·`views/`·`base-views/`).

## 아직 없는 것
- 받은 캐릭터를 번들 CharSet(288×256, 8명)으로 묶어 `src/assets/bundled.ts` 에 넣는 단계.
- 하네스 레지스트리(`src/harnesses/_core`, PR #1832) 등록.

## 동물 기반 필드 몬스터

화면의 「새 캐릭터 만들기 → 동물 기반 몬스터」 또는 `produce --creatures`를 쓴다.
Animal.png의 개·고양이·닭·양·소·말·호랑이·사자 8종을 원본으로 삼아
숲·화염·서리·독·그림자·바위·물·전기·균류·갑각·언데드·정령·마수 계열을 직접 찍는다.
100종 계획, 동시 작업 2종, 검토 대기 12종이 기본이다. 사용자의 GIF 선택이 대기 슬롯을 열면 이어 만든다.

`recipes.create_creatures`는 원본 atlas/12프레임/저작 지시/ROI/라이선스/모델·도구 해시를 봉인한다.
번들 참고 그림은 `sourceMode: bundled-animal-reference`이며 사람이 남긴 그림으로 기록하지 않는다.
모델은 GPT 6.1 sol high, 초기 이미지 첨부는 0장, `grid`로 12장 모두 직접 저작한다.
`animalPolicy: 1`과 각 원본의 `animalProfile`을 봉인·manifest·행·meta·납품에 묶는다.
사람형 `motionPolicy`는 null이며 `motion.py`의 기존 사람형 계약은 보존한다.

`animal_motion.py`는 미리 표시한 몸통 중앙의 정지↔각 걸음 변화와 보이는 발의 0↔2 교대를 읽는다.
사족보행 옆 방향은 앞발/뒷발을 따로 요구하며 앞/뒤 방향의 겹친 발은 보이는 발만 검사한다.
닭은 조류용 몸통/두 발 영역을 쓴다. 몸통은 실제 RGBA/공간 경계 각각 4px·두 줄·두 열,
발은 각각 2px 이상이며 색 치환·전체 정지 이동은 걸음으로 인정하지 않는다.
영역은 결과에서 재탐색하지 않는다. 이 작은 원본 체형을 유지하는 결함 검사이며 자연스러운 보행의 증명이 아니다.
`views/motion.json/png/gif`에 좌표·방향별 차이·느린 GIF를 보존하고 구현/원본/현재 그림 해시를 납품에 묶는다.
정책·영역·진단 증거를 제거하거나 바꾸면 선택/내보내기/공용 등록에 사용할 수 없다.

기존 투명/12장 직접 저작/세 배경 GIF 재읽기/중복/설명 검사도 함께 적용한다.
기술 오류는 최대 2회 같은 모델이 직접 수정한다. 미감과 서식지 설정의 적합성은 사용자가 결정한다.
남긴 몬스터도 `--seed-run RUN`으로 다시 봉인해 같은 동물 영역/저작 지시로 변주할 수 있다.
옛 봉인 기준의 도구 해시를 새 해시로 덮어쓰지 않는다.

사람 캐릭터와 몬스터는 `http://mdc-server:18314/`의 같은 공방에서 검토한다.
기본은 모든 제작이며 특정 작업만 볼 때 실행 선택을 쓴다. 옛 `collection=monsters` 링크도 같은 화면으로 정리한다.
상단의 몬스터 완성/대기 집계와 카드 표시로 확인하며 이미 고른 그림은 남김/폐기 탭에서 본다.
새 제작을 시작해도 전체 목록을 유지하고 기존 선택은 보존한다.
옛 사람형 메타데이터에 run/동물 정책이 없으면 동물 검사를 새로 강제하지 않는다.
새 봉인 실행은 manifest와 meta의 recipe binding도 일치해야 한다.
도구 변경 뒤에는 기존 봉인을 고치지 않고 새 기준/실행을 만든다.
`--start-index N`은 새 기준에서 앞의 N개 제작 순서를 생략한다. 이전 산출·사용자 선택은 복사하거나 바꾸지 않는다.
동물 원본 순환과 13가지 속성을 서로 교차해 처음 대기열에도 서로 다른 계열을 넣는다.

이전 실행을 새 기준에서 이어 만든 경우 `production-state.json`의 `phase: continued`와 `continuedIn`을 기록한다.
화면은 완료한 GIF를 계속 검토하게 하고 이어지는 실행으로 연결한다. 옛 실행을 다시 생성하지 않는다.
일반 봉인 실행의 재개도 작업자 실행 전 도구 해시를 확인하므로 원본 선택/정지 상태를 먼저 바꾸지 않는다.
