# RM2000 캐릭터 칩 하네스

24×32 프레임 × 3걸음 × 4방향의 에디터용 캐릭터를 만든다. 생성 이미지 대신 GPT 6.1 sol high가 원본 격자를 직접 편집한다.
원샷 저작 → 12프레임 픽셀 검사 → Sonnet medium 독립 검수 → 사용자 선택 → 검수 팩 순서다.

```bash
npm run harness -- charset-actor bulk /path/to/manifest.json --par 2 --batch-size 4 --detach
npm run harness -- charset-actor verify --output /path/to/evidence.json
npm run harness -- charset-actor export RUN --discard-failed
```

결손·검수 실패는 합격 팩에 넣지 않는다. 검수 갱신 대기는 영구 폐기하지 않는다. API 받기·렌더·판정은 현재 격자 해시에 결부한다.
원본 첨부와 업로드 파생물은 `CHR_HARNESS_DATA`(기본 `~/.local/share/oprn/charset-actor-harness/`)에 둔다.
이 단계는 후보 자산 저작이며 프로젝트/공용 자산에 자동 설치하지 않는다.

상세 구조·픽셀 검사·재개/폐기 계약·실측 근거는 [캐릭터 칩 저작 하네스](../charset-actor-harness.md)와
[실행 지침](../../src/harnesses/charset-actor/README.md)에 있다. 후보 화면은 http://mdc-server:18314/ 이다.
