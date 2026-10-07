# 조수 공간 제작 시각 품질 (space-craft)

조수에게 자연어로 방·판타지 실내·현대 실내·무림 장소를 만들게 하고, 「보기에 괜찮은가」를 카테고리·모델별로 잰다.
데이터 정확성은 `assistant-capability` 가 본다. 이 하네스는 같은 실행기(입력창 → Pi → 저장 → 새 브라우저 재로드)를 재사용하고 판정 층만 다르다.

## 단계

```bash
npm run harness -- space-craft list
npm run harness -- space-craft prepare --out qa-runs/harnesses/space-craft/<실행> [--case id] [--repeat 3] [--shared-from <고정 공용 DB>]
npm run harness -- space-craft run --out <실행> --ai-config harness-data/assistant-capability/ai-configs/gpt-6.1-sol.json
npm run harness -- space-craft measure --out <실행>
npm run harness -- space-craft sheet --runs gpt=<실행A>,gemini=<실행B> --name <시트 이름>   # → ~/claude-viz/<이름>.html
npm run harness -- space-craft status --out <실행>
```

- 시작 상태는 새 프로젝트(`createBlankProject`) 그대로다. 현대 과제만 시작 맵 칩셋을 `jp_city` 로 둔다.
- 반복은 `<과제>-r1..rN` 폴더로 나눈다. 모델 시도는 덮어쓰지 않는다(`run --skip-completed` 로 남은 것만).
- 공용 DB 사본은 실행 폴더당 하나이고 시도마다 하드링크한다.

## 판정 층 (계획: 1~2 구현됨)

1. **과제** — `harness-data/space-craft/seed.json`. 카테고리별 기대 칩셋 계열과 금지 계열(easyrpg).
2. **결정론 지표** (`measure`) — 조수가 만들거나 바꾼 맵마다: 칩셋 계열, 들어오는 이동·시작 위치(입구) 유무,
   입구에서 통행 칸 도달 비율, 빈 바닥 %·빈 정사각형·좌우 대칭 배수(`layoutQuality`), 원본 크기 PNG + 4분면 확대(sha256).
   **기계 통과는 시각 합격이 아니다.**
3. 그림 판정자 — 렌더와 4분면을 비전 모델 둘이 축별(구조·용도 기물·빈 공간/동선·세계관 이질 기물·화풍/시점) 1~5점과 좌표 근거로 매긴다. 그림 해시에 묶는다. (미구현)
4. 판정자 교정 — 검수 통과 맵(좋은 예)과 그 맵을 망가뜨린 변형(벽 뜯기·기물 절반 삭제·이질 기물·복붙 대칭)으로 판정자가 좋은 예를 90% 이상 높게 매길 때만 점수를 쓴다. (미구현)
5. 사람 판정 — 시트에서 좋다/별로. 판정자 기준 세트가 되고 일치도를 기록한다. (미구현)

## 무림

전용 칩셋이 없다(2026-10-07). 기대 계열을 비워 두고 쓰인 계열만 기록한다. 처음에는 품질이 아니라 정직성(없다고 말하는지,
다른 화풍을 섞어 가짜로 만들지 않는지, 스토어를 찾는지)을 본다. 품질 측정은 무림 칩셋을 만든 뒤에 한다.
