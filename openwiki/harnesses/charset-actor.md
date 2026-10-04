# RM2000 캐릭터 GIF 공방

GPT 6.1 sol high가 자유롭게 24×32 캐릭터 도트를 만든다. 사용자는 걷는 GIF를 보고 남기기/폐기만 결정한다.
머리/몸체 결손·색 키·프레임 구조만 자동 차단하며 별도 모델의 미감 점수를 선택 관문으로 사용하지 않는다.

```bash
npm run harness -- charset-actor produce --count 100 --reference /absolute/reference.png
npm run harness -- charset-actor serve --port 18314
npm run harness -- charset-actor export RUN
python3 src/harnesses/charset-actor/harness.py publish-shared
```

`produce`는 작업을 터미널과 독립적으로 시작한다. 화면에서도 개수·선택적인 전체 방향·참고 그림을 넣어 시작할 수 있다.
완성된 네 방향 GIF마다 한 번의 남기기/폐기, 선택 되돌리기, 일시 정지/재개, 실제 남긴 캐릭터만 ZIP 다운로드한다.
현재 그림의 해시가 바뀌면 사람의 선택도 다시 확인한다. 사용자 선택·산출·원본은 `CHR_HARNESS_DATA` 아래 보존한다.
사람이 남긴 그림과 설명은 사용자 공용 SQLite의 `charset-actor-kept`에 자동 등록한다. 에디터를 새로고침하면 새/기존 프로젝트와 AI NPC 검색에서 쓴다.
폐기/되돌리기는 공용 목록에서 제외하고 기존 프로젝트 그림을 보존한다. 과거 모델 검수 모드는 이전 실행 재현용으로 유지한다.

상세 계약은 [캐릭터 하네스](../charset-actor-harness.md), 명령과 저장 구조는
[실행 지침](../../src/harnesses/charset-actor/README.md). 화면 http://mdc-server:18314/.
