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

## 판정 층 (1~5 구현, 2026-10-07)

1. **과제** — `harness-data/space-craft/seed.json`. 카테고리별 기대 칩셋 계열과 금지 계열(easyrpg), 과제마다 필수 물건 `requires`.
2. **결정론 지표** (`measure`) — 조수가 만들거나 바꾼 맵마다: 칩셋 계열, 통행 칸 도달 비율(입구가 있으면 입구에서, 없으면
   가장 큰 통행 덩어리에서), 빈 바닥 %·빈 정사각형·좌우 대칭 배수(`layoutQuality`), 원본 크기 PNG + 4분면(sha256).
   입구 유무는 참고(`advisory`)다 — 과제 문장이 연결을 요구하지 않는다. **기계 통과는 시각 합격이 아니다**:
   1회차에서 대칭 배수는 잘 지은 서재를 떨어뜨렸고, 큰 빈 맵 구석의 작은 방은 못 잡았다.
3. **그림 판정자** (`bun src/harnesses/space-craft/node/judge.mts --out <실행> --judges gpt,gemini [--calibrate]` → `judge.json`) —
   정수배로 키운 그림을 gpt-6.1-sol(그림 역할)과 gemini-3.8-flash 에 보이고, 구조 예/아니오(벽에 붙을 것이 벽에·방 안·잘림 없음·
   문 앞·방이 맵을 채움), 빈 바닥 정도, 필수 물건 유무, 느낌 1~5(layout·style·genre)를 받는다. **종합 점수는 판정자가 아니라
   코드가 낸다**(`overallFrom`: 벽·방 밖·잘림 위반 ≤2, 다른 배치 위반 ≤3, 필수 물건 2개↑ 없음 ≤2·1개 ≤3, 빈 바닥 넓음 ≤3,
   그 밑에서 느낌 평균). 판정자에게 종합을 맡겼더니 벽난로·선반이 바닥 한가운데 선 사본에도 원본과 같은 3점을 줬다.
4. **판정자 보정** (`--calibrate`) — 같은 맵의 가구 층을 지운 사본(`stripped`)과 오른쪽 3·아래 2칸 민 사본(`shifted`)을 함께
   판정해, 원본(2.5↑)이 사본보다 높아야 한다. 2026-10-07: 두 판정자 22/22. 두 판정자 차이 1.5↑ 은 「갈림」으로 시트에 빨갛게
   표시한다(14장 중 1장). 갈린 판정은 그림을 직접 보고 루브릭 문장을 고쳤다 — 칸막이에 건 방패·옆벽 책장·출입 계단을 위반으로
   보던 것.
5. **사람 판정** — 시트의 좋다/보통/별로 단추(브라우저 localStorage). 위 띠에 판정자가 사람과 1점 안으로 맞은 수를 바로 보이고
   「판정 복사」로 JSON 을 넘긴다. 사람 판정이 판정자 루브릭을 고치는 기준이다.

### 1회차에서 나온 것 (2026-10-07, 과제당 1회)

- gpt-6.1-sol 은 실내 평면을 64×40·44×28 로 크게 잡고 구석에만 방을 그렸다 → `build_hand_interior_room` 이 바깥 막힌 여백을
  자르도록 고침(0772193d70). gemini 는 처음부터 방 크기로 지었다.
- 편의점(진열대·계산대)과 무림 수련장(목인장)은 **부품이 없다** — 두 모델 모두 실패했고 판정자도 「필수 물건 없음」으로 잡았다.
  모델 탓이 아니라 자산 부족이다. 부품은 해당 하네스(실내 기물·jp-city)로 사람이 골라 넣는다.

## 무림

전용 칩셋이 없다(2026-10-07). 기대 계열을 비워 두고 쓰인 계열만 기록한다. 처음에는 품질이 아니라 정직성(없다고 말하는지,
다른 화풍을 섞어 가짜로 만들지 않는지, 스토어를 찾는지)을 본다. 품질 측정은 무림 칩셋을 만든 뒤에 한다.
