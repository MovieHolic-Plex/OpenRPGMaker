# RM2000 캐릭터 GIF 공방

GPT 6.1 sol high가 정지 4장·걷기 8장, 24×32 캐릭터의 12프레임 전부를 직접 찍는다. 사용자는 걷는 GIF를 보고 남기기/폐기만 결정한다.
머리/몸체 결손·색 키·프레임 구조만 자동 차단하며 별도 모델의 미감 점수를 선택 관문으로 사용하지 않는다.

```bash
npm run harness -- charset-actor produce --count 100 --reference /absolute/reference.png
npm run harness -- charset-actor serve --port 18314
npm run harness -- charset-actor export RUN
python3 src/harnesses/charset-actor/harness.py publish-shared
npm run harness -- charset-actor audit --run RUN --refresh-previews
npm run harness -- charset-actor walk-qa --run RUN --out /absolute/evidence-outside-repo
```

`produce`는 작업을 터미널과 독립적으로 시작한다. 화면에서도 개수·선택적인 전체 방향·참고 그림을 넣어 시작할 수 있다.
한 화면에 한 캐릭터의 네 방향 걷기와 게임 속 이동 GIF를 상시 보여준다. 남기기/폐기하면 즉시 다음 후보로 넘어가고 뒤에서 저장한다.
이전/다음·A/R·직전 선택 되돌리기, 일시 정지/재개, 실제 남긴 캐릭터만 ZIP 다운로드한다.
걷기는 자홍색 체커가 기본이며 흰색·검정·잔디로 바로 전환한다. `audit`는 12프레임과 세 배경의 원본 비교·결손 좌표·출하 PNG/GIF 대조를 저장소 밖에 남긴다.
새 옷/장식 안에 가둔 원본 배경도 투명 구멍이다. alpha 검사 정책 갱신은 같은 픽셀의 사용자 선택 binding을 유지한다.
새 제작은 `animationMode: model-12`이며 모델이 납품한 걷기를 그대로 렌더한다. `model-frames.json`에 12장 각각의 실제 픽셀 해시와 변경 수·모델을 기록한다.
`bulk`는 원본 시트와 manifest `visualReferences`(실행 폴더 안 최대 4장)를 GPT 첫 입력에 이미지로 첨부한다. 묶음 `visual-inputs.json`과 후보 meta에 파일 순서·SHA256을 남긴다.
`audit`가 저작 기록/현재 그림 binding과 PNG/GIF를 다시 읽는다. `walk-qa`는 이전 전파 실행의 비교용이다.
현재 그림의 해시가 바뀌면 사람의 선택도 다시 확인한다. 사용자 선택·산출·원본은 `CHR_HARNESS_DATA` 아래 보존한다.
사람이 남긴 그림과 설명은 사용자 공용 SQLite의 `charset-actor-kept`에 자동 등록한다. 에디터를 새로고침하면 새/기존 프로젝트와 AI NPC 검색에서 쓴다.
폐기/되돌리기는 공용 목록에서 제외하고 기존 프로젝트 그림을 보존한다. 과거 모델 검수 모드는 이전 실행 재현용으로 유지한다.

상세 계약은 [캐릭터 하네스](../charset-actor-harness.md), 명령과 저장 구조는
[실행 지침](../../src/harnesses/charset-actor/README.md). 화면 http://mdc-server:18314/.
