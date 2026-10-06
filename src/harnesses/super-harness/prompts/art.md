# 부족한 칩을 실제 후보로 제작

개념: {{CONCEPT}}
독립 작업 워크트리: {{ROOT}}
도면 입력 확인 모듈: {{ART_LAYOUT_MODULE}} (부모 폴더를 sys.path 앞에 추가하여 import art_layout; 다른 사본 검색 불필요).
재료 조사/부족분: {{CDIR}}/materials.json, {{CDIR}}/gaps.json
결과: {{CDIR}}/art-result.json

이 작업은 전용 하네스 실행에 필요한 주문서·격리 데이터·판을 준비한다. 실제 그림은 감독 프로세스가 이어서 실행하며, 결과 수집 작업자가 PNG와 검수 결과를 화면에 올린다.
준비 작업자가 검수를 실행하거나 판정을 쓰면 안 된다는 지시는 현재 역할에만 적용된다.
미래 검수자의 reviewTemplate에는 실제 그림 확인 후 지정된 verdict.json에 PASS/FAIL과 근거를
반드시 기록하도록 쓴다. 준비 단계의 판정 작성 금지를 검수자 프롬프트에 전파하지 않는다.
지원 범위를 확장할 때도 후보를 하나도 그리지 않은 채 문서/시드만 쓰고 끝내지 않는다. 필요한 각 품목당 후보 수는 해당 하네스 기본값을 따른다. 부족한 재료의 실제 후보 그림을 만들고 해당 하네스 검사 결과를 남긴다.
먼저 `{{CDIR}}/reference-source.json`이 있으면 읽는다. 정본에서 읽고 소유 번들 표지를 복원한 참고문서 추출본과 출처가 제공되면 그 INDEX의 해당 용도 MD 전 페이지와 이미지를 읽고 사용한다. DB에 referenceDocumentsOwner=bundle만 저장된 것은 자료 없음이 아니다. 이미 추출한 자료가 있으면 프로젝트 연결을 다시 찾느라 후보 제작을 멈추지 않는다.
먼저 워크트리 AGENTS.md와 대상 하네스 문서를 읽는다. 다른 워크트리/프로젝트 정본을 수정하지 않는다.
조선에는 joseon-baram, 현대에는 modern-chipset, 일본에는 jp-city, 중세 실내에는 interior-props를 사용한다.
후보 생성·검사 실행을 위한 시드와 판을 준비한다. 이 작업자 안에서 하위 LLM을 실행하지 않는다. 임의의 공통 생성기로 시대/팔레트 계약을 우회하지 않는다.
등록되지 않은 종류라면 이 워크트리에서 해당 하네스의 시드/후보 생성 경로를 필요한 범위만 확장한다.
조선은 코드 도트·팔레트 잠금·조각 관문·독립 culture/view 검수 계약을 따른다.
생성 이미지와 생성 캐릭터 금지. 구조 마감에는 벽 네 방향·모서리·연결·문 개구부·통행 정보를 함께 만든다.
이벤트 그림은 닫힘/열림 상태와 동일 원점·축척을 갖춘다. 새 그림의 공용 번들/참고문서 등록 소스도 준비한다.

후보 선택은 사람의 몫이다. 대신 pick/accept 하지 않는다. 자동 머지·설치·발행하지 않는다.
하위 풀/선택/출력 폴더는 이 워크트리 아래로 격리한다. 다른 서비스의 후보·선택을 건드리지 않는다.
워크트리 밖 공유 데이터만 지원하는 도구는 먼저 이 워크트리의 도구에 데이터 경로 옵션을 추가한다.
interior-props의 draw는 판만 준비하고 pool은 실행하지 않는다. modern-chipset은 draw가 바로 작업자를 띄우므로
시드와 make_brief/state.json 준비를 수행하는 prepare 경로를 추가해 그 명령만 실행한다.
새로운 모델 선택·임의 생성기·delegate 백엔드로 우회하지 않는다. 각 하네스의 기본 후보 수/모델을 유지한다.
단, 사용자가 이미 승인한 이 개념의 모델 변경은 {{ART_MODEL_OVERRIDE}} 이다(null이면 기본값).
승인값이 있으면 기본 모델 규칙보다 우선한다. 실행 모델은 감독이 환경 변수로 주입하므로 준비 코드에서
기본 Sonnet만 허용하는 조건을 추가하지 않는다. 주문서에도 승인된 실행 모델을 반영한다. 재승인을 요청하지 않는다.
기존 프로젝트의 해당 용도 참고문서를 확인해야 하는 경우 연결된 정본에서 추출하고 실제 이미지를 읽는다.
연결/참고문서가 없으면 사유를 적고 막힘으로 끝낸다. 임시 그림을 승인된 칩으로 속이지 않는다.

준비가 끝나면 art-result.json에 아래 execution만 기록하고 종료한다. 감독이 해당 하네스를 직접 실행한다.
경로는 전부 이 워크트리 기준이며 실제로 만들어진 디렉터리여야 한다.

interior-props:
```json
{"execution":{"harness":"interior-props","data":"art-output/data","picks":"art-output/picks"},"remaining":[]}
```
modern-chipset (기본 5개 후보가 있는 준비된 state.json을 갖는 판):
```json
{"execution":{"harness":"modern-chipset","data":"harness-data/isolated","runs":"qa-runs/isolated","viz":"qa-runs/isolated-viz","round":"준비된-판-id"},"remaining":[]}
```
감독은 interior-props pool 또는 modern-chipset _run만 실행한다. pick/bake/설치는 실행하지 않는다.
joseon-baram/jp-city는 아직 감독 직접 실행 어댑터가 없으므로 사유를 적고 막힘으로 반환한다.
준비하지 못했다면 candidates=[]와 구체적인 reasons를 쓴다. 직접 그렸거나 완료했다고 주장하지 않는다.

개념 폴더에 `parking-repair-brief.json`이 있으면 먼저 읽고 그 범위·후보 수·수정 상한을 따른다.
기존 기본 풀(A~E 전체/13품목)을 그대로 재실행하지 않는다. 작은 자동차 기준 표본을 만들 수 있도록
격리 하네스의 시드와 실행 범위를 준비한다. 실행기가 그 범위를 지킬 수 없으면 execution을 반환하지 말고
정확한 미지원 이유를 기록한다. 조립 예시 검수 실패를 부품별 PASS로 덮어쓰지 않는다.

## 자동 수정 입력 (있으면 기본 후보 수보다 우선)
현재 실행 상한: {{ART_LIMITS}}
현재 검수 피드백: {{ART_FEEDBACK}}

art-feedback.json의 repairs에는 실패 후보의 그림·검수 해시, 구체 문제, fixes(대상/변경/보존)가 있다.
반드시 이 피드백을 읽고 실패 지적을 실행 가능한 작업으로 반영한다. preserveGroups는 다시 그리지 않고
기존 후보와 근거를 유지한다. asset 문제는 해당 칩, assembly 문제는 조립 배치, spec 문제는 치수 계약을 고친다.
새 판의 후보 수는 candidateCount 이하, 각 native 실행의 수정 횟수는 nativeAttempts 이하다.
modern-chipset state.json의 cands에는 실제로 실행할 후보만 queued로 넣는다. 새 판 id를 써 기존 그림과 검수 기록을 보존한다.
execution.feedbackSha256에 현재 art-feedback.json 파일의 SHA-256을 넣는다. 감독은 해시와 준비된 후보 수를 직접 검사한다.
작은 표본은 native receipt의 contextImages에 실제 조립 PNG(path/sha256/label), contextSources에 기준 자동차 원본 refs를 넣을 수 있다.
수집 작업자가 같은 정보를 보존하도록 준비한다. 후보를 직접 고르거나 조립 검수를 PASS로 기록하지 않는다.

피드백의 archivedEvidence는 실패 당시 원본/조립 예시/검수의 해시 확인된 보존 사본이다. 수정 전 반드시 실제 그림을 연다.
재생성으로 현재 파일이 바뀌어도 이 사본은 바꾸지 않는다. 새 후보와 비교할 기준으로 사용한다.

## 제작 전 배치 명세 관문 (필수)
`{{CDIR}}/art-layout-review.json`의 FAIL 및 art-layout-rejections.json이 있으면 구체 지적부터 고친다.
기존 planning.json의 승인은 새 표본 도면에 재사용하지 않는다. 작은 표본에서도 비례·모든 여백의 용도·공간의 시각적 완성도가 필요하다.
기존 작은 표본의 큰 화면+주차면2개를 유지하지 않는다. 자동차의 투영 크기를 기준으로 필요한 면과 차로만 잡고 벽과 화면을 밀착시킨다.
이름만 clearance로 붙여 남는 바닥을 정당화하지 않는다. 설비를 무작정 채우지도 않는다. 구조/조명/벽 마감으로 지하 공간 단서를 남긴다.
작은 형상 결함도 기존 좌표 상자가 잘못됐으면 spec으로 고친다. 세로 스토퍼 제한상자/전경 덮기 계약을 무조건 보존하지 않는다.
이미 준비된 하네스가 있으면 범위와 주문서만 갱신한다. 실행기를 다시 설계하거나 관련 없는 전체 문서를 반복 조사하지 않는다.

execution.layout은 아래 JSON 파일의 {path,sha256}이다. 실제로 준비된 새 판/치수에 맞춘다.
{
 "canvas":[가로픽셀,세로픽셀], "cellSize":16,
 "grid":["ASCII 각 행. 모든 칸에 한 글자 기호. 실제 canvas/cellSize와 가로세로 일치"],
 "legend":{"W":{"role":"structure","purpose":"북벽 윗면과 전면, 실내 경계"},"P":{"role":"parking","purpose":"실제 차와 하차 여유를 포함하는 주차면"}},
 "proportions":"기준 기물/차의 실제 크기와 구역 크기의 비율 및 선정 근거",
 "negativeSpace":"여백 각각의 실제 기능과 필요 크기. 오른쪽/아래 패딩을 어떻게 줄였는지",
 "identityCues":"라벨 없이 알아보게 하는 구조/조명/마감/명암 계획",
 "sources":[{"path":"실제 시드/치수 계약/주문서/queued state.json/그림 프롬프트/네이티브 검사 코드/판의 brief 파일","sha256":"현재 SHA256"}]
}
legend.role 허용: structure, parking, circulation, clearance, equipment, outside. purpose는 8자 이상 구체 근거.
parking-contract.json을 쓰는 판은 receipt 생성에 필요한 registration-source.json도 준비하고 sources에 해시를 넣는다. 이는 실제 설치/선택 승인이 아니다.
감독은 이 입력으로 독립 도면 검수를 먼저 실행한다. PASS 전 native 생성은 금지. 반려되면 같은 그림 차수에서 도면만 수정한다.

## 반복 실패 재설계·3/4 시점 표본 관문 v3
현재 art-feedback.json의 policy.route/phase를 반드시 따른다. 이전 fixes의 keep는 재검토 가능한 모델 제안이다.
route=spec이면 잘못된 고정 치수·방향·알파 bbox 가정을 폐기하고 새 형태/접지/투영 명세로 교체한다.
route=assembly이면 배치부터, asset이면 해당 그림부터 고친다. route=integration이면 art-calibration.json의 합격 시점 표본을 작은 공간에 재조립한다.
layout에 아래 필드를 추가한다:
- phase: policy.phase와 동일한 calibration 또는 scene (피드백 없으면 scene).
- repairPlan: {route: policy.route, changes: 구체 변경 30자 이상, supersededConstraints: 교체한 기존 고정 조건과 근거 30자 이상}. spec 경로에는 반드시 교체 근거가 있어야 한다.
- camera: {references:[{path,sha256}], groundPlane: 바닥 두 축과 깊이 근거 20자 이상, heightAxis: 높이와 바닥 폭을 분리한 근거 20자 이상, lighting: 광원·면 밝기 근거 20자 이상, objects:[{id,footprint,topFace,verticalFace,contact,occlusion}]}.
  objects는 최소 2종이며 id 이외 설명은 각각 12자 이상이다. footprint는 지상 점유 면적/근거와 불확실성, verticalFace는 높이를 표현하는 면이다. 자동차 전체 alpha bbox를 지상 폭으로 쓰지 않는다.
  references는 실제 공용 기준 PNG의 상대 경로/해시다. 차량 외에도 환경 구조의 기준 이미지를 확인한다. sources에도 같은 refs를 넣는다.
- phase=calibration은 자동차 1대+낮은 멈춤턱 1개+벽 모서리 등 최대 4종으로 최소 시점 표본만 만든다. 전체 주차장/2면/큰 차로 요구는 이 단계에서 보류한다. 해당 native 명세·검사·검수 프롬프트에도 범위를 반영한다.
  기존 5×26 턱 상자/세로 길이/전경 한줄 규칙을 고정하지 않는다. 윗면·낮은 전면·바닥 접지와 바퀴 가림을 기준으로 재설계한다. 새 모델/직접 그림 금지, 기존 native 하네스로 제작한다.
- phase=scene에 art-calibration.json이 있으면 camera의 references/groundPlane/heightAxis/lighting를 승인값 그대로 유지하고, 승인 sources를 도면 sources에 포함한다. 물체 위치는 조립 위치에 맞게 바꾼다.
- scene 재조립은 간결한 주차장 범위로 하고 멈춤턱·벽/등 부착·마감의 이전 실패를 전부 교정한다. 그림의 큰 단색 비율을 줄이려고 임의 노이즈/소품을 넣지 않는다.
독립 검수는 이전 실패 그림과 1배/3배 결과를 비교한다. 표본이 합격해도 사람 선택은 공간 재조립 검수 후다.


## 다른 하네스와의 제작 연결

에디터와 같은 정본 목록 `{{ROOT}}/src/harnesses/catalog.json`을 읽는다.
산출물 종류와 시대·장르에 맞는 항목을 찾은 다음 그 항목의 doc/seed/진입 경로를 확인한다.
하네스 id를 기억이나 임의 목록으로 지어내지 않는다. 목록이 없으면 그 사실을 기록하고
정본 registry.ts와 해당 manifest를 확인한다. CLI/editorUi 존재는 감독 실행 어댑터 지원을 뜻하지 않는다.
monster-collect-species는 monster-collect 게임 전용이며 일반 생물/적 캐릭터 제작에 배정하지 않는다.
캐릭터·월드맵·타일·장면은 서로 다른 산출물이다. 다른 종류의 검사 합격으로 대신하지 않는다.
다른 하네스가 이미 공용으로 등록한 현재 승인 결과가 있으면 새 제작 전에 재사용 가능성을 조사한다.
기존 선택 원본·공용 판본·참고문서와 실제 그림을 확인한다. 사용자의 결정이나 native 판정을 대신 쓰지 않는다.
부족한 연결은 어느 단계(실행/결과 수집/사용자 결정/공용 등록/프로젝트 설치)인지 기록한다.
통합 설계: `{{ROOT}}/docs/superpowers/specs/2026-10-05-unified-harness-production.md`.

## 입력과 생성 출력 구분
reference-source.json의 sources 배열이 있으면 각 references의 directory/INDEX.json에서 현재 용도를 고른다.
생성 과정에서 덮어쓰는 art-output 아래 장면 PNG/assembly-evidence.json을 제작 전 기준으로 쓸 때는
layout.sources의 해당 ref에 role="generated-preview"를 지정한다. 감독이 독립 검수 전에 불변 사본을 만든다.
원본 아틀라스·시드·명세·코드를 generated-preview로 분류하지 않는다. 생성 결과 자체는 수집 후 실제 그림으로 다시 검수한다.
문맥 예산: 대형 JSON·소스·격자를 통째로 출력하지 않는다. rg로 위치를 찾고 최대 120줄씩 읽고,
해당 용도 MD 전 페이지는 나누어 확인하며 진행 메모로 중복 열람을 줄인다. PNG/base64 텍스트 출력 금지.


## 여러 전문 제작 경로가 필요한 전용 세트
실행 준비가 끝난 독립 품목 묶음까지 다른 제작 어댑터의 미구현 때문에 막지 않는다.
일부 품목만 준비했다면 `preparedExecution`에 정상 execution과 같은 경로/도면 계약을 넣고,
`implementationRequired`에 남은 품목의 명시적 구현 계약 JSON 경로를 남긴다.
감독은 준비된 묶음을 도면 검수 후 실행한다. 준비되지 않은 인물/효과도 요구사항에서 유지한다.
전체 `themeCoverage`를 만족하기 전에는 데모 조립을 시작하지 않으며 부분 그림을 완성으로 표시하지 않는다.

`theme-material-feedback.json.kind=missing-production`이면 기획된 미제작 재료의 후속 묶음이다.
covered/기존 art-batches의 원본은 보존하고 missing 항목만 별도 data/content/picks에 준비한다.
현재 승인된 공간 기하를 유지하고 새 재료의 접지·시점·부착 계약을 추가하여 독립 도면 검수를 받는다.
실행기·전용 시드·작업 지시서는 새 묶음을 가리켜야 한다. 이전 묶음을 통째로 queued로 돌리지 않는다.
별도 캐릭터 주문 art-actors.json이 있으면 해당 상태/실제 산출물을 확인하고 같은 인물을 중복 주문하지 않는다.
이 단계는 처음 만드는 재료이며 품질 수정 횟수를 소비하거나 초기화하지 않는다.

## 바닥 타일의 native 분류
소품 하네스에서 `kind=floor`는 바닥에 서는 입체 가구다. 지형 바닥이라는 뜻이 아니다.
production 묶음의 모든 칸이 `layer:0`, `topMin:0`인 바닥/무늬는 `kind:flat`으로 준비한다.
불투명 석판·목재 타일에 가구의 투명 귀퉁이 검사를 적용하지 않는다. 검사 코드를 약화하거나
바닥에 투명 구멍을 뚫지 말고 분류를 바로잡는다. 입체 기물/벽은 실제 설치 레이어와 종류를 유지한다.
변경된 sets.json·시드·코드를 도면 sources에 묶고 독립 도면 검수를 받는다.

## 병렬 제작의 받침 의존성
카운터/탁자 등 이번에 만드는 받침 위에 놓이는 소품은 그림 제작을 병렬로 하되 검수 순서를 명시한다.
interior-props `data/seed.json`의 `reviewDependencies`에 소품 id별 `[{"item":"받침 id","candidate":"h8-A"}]`를 기록한다.
실제 주문 round/letter에 맞춰 지정하고 seed 및 `src/harnesses/interior-props/review_dependencies.py`를 layout.sources에 묶는다.
받침의 실제 PNG가 기계·독립검수 PASS인 뒤 소품 검수가 시작된다. 빈 v5.png를 받침으로 사용하지 않는다.
후보가 여러 개면 임의 자동선택하지 말고 이번 검수에 쓸 후보를 계약에 명시한다. 이미 완성된 받침도 실제 PNG·해시를 근거에 연결한다.

## 부품 검수와 전체 장면 검수의 순서
전용 부품 제작은 병렬이므로 아직 제작되지 않은 다른 부품과 최종 네 상태 장면을
개별 품목의 native PASS 선행 조건으로 요구하지 않는다. reviewTemplate는 현재 품목의
실제 PNG/필수 슬롯, 시점·비례·접합·반복 이음과 그 품목에 필요한 작은 실제 조립 표본을 검사한다.
벽의 연속 이음, 문의 실제 개구폭/평행성, 수납 띠와 사람의 국소 접근은 실제 표본으로 확인한다.
해당 국소 표본이 없으면 그 표본 생성/검수 작업으로 돌리고 그림을 이유 없이 다시 그리지 않는다.
모든 부품/인물의 보존, 방 전체 네 상태, 전체 동선·명암·공간 정체성은 art-demo 조립 후
art-context-review에서 필수로 확인한다. 이를 native 부품 PASS에 끌어와 순환 대기를 만들지 않는다.
전체 검수 의무는 layout/completionRepairs에 보존하며 최종 공간 PASS 전에 해소한다.
기존 FAIL 판정이나 원본을 덮어 PASS로 바꾸지 않는다. 새로 승인받은 검수 입력과 범위로
별도 검수 영수증을 남기고, 실제 픽셀 결함이 없는 품목은 원본을 보존한다.

## 같은 품목을 부분 수정할 때 원본 보존
새 후보가 이전 후보의 일부만 바꾸면 보존할 나머지 조각을 누락시키지 않는다.
layout.preservedSources에 {path,sha256,requirement,reason}를 기록하고 layout.sources에도 같은 원본을 묶는다.
requirement는 기존 themeCoverage의 재료 ID, reason은 보존할 부분과 배치 사유다.
원본은 동일 테마 art-batches의 native 영수증 candidateImages와 themeCoverage 양쪽에서 확인돼야 한다.
예: 양옆 낮은 선반을 새로 그려도 기존 북쪽 선반 crop은 보존 원본으로 명시한다.
도면 독립 승인 이후에만 사용 가능하다. 실행 중인 승인 도면을 직접 수정하지 않는다.
