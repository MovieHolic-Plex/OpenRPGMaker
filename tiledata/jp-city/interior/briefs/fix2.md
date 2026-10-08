## 2묶음 고치기 2회차 (적대적 관문 interior-shop 1회차 불합격 반영)

`common-shop.md` 의 그림 규칙·금지(사람·글자·로고 금지, modern3 램프만, 3/4 시점, PNG 1000px 넘으면 크롭)를 그대로 따른다. 그 문서를 먼저 읽는다.
관문 판정 원문: `tiledata/jp-city/gates/interior-shop.json` 의 findings (네 몫만 찾아 읽는다).

### 이번 회차는 무엇이 다른가
- 예제 정본은 `tiledata/jp-city/interior/examples/<이름>.json` (+ 표 `places2.json`). `interior/demo/` 아님.
- 판정 근거는 **조수 도구 그대로 짓는 검사**다. preview.py 「문제 0」은 근거가 아니다.
  `npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/qa/check-interior-examples.mts <이름…>` → 네 예제 모두 `OK`.
  (규칙: 벽 가구는 앞칸이 닿아야 한다 · 모든 바닥이 입구에서 닿아야 한다(직원용 카운터 끝 틈) · 탁상(4층)은 남쪽 가구의 솟은 부분과 겹치면 goods-no-layer · oneRow 탁자는 h=1 · 옆문은 세로 3줄 틈에서만 · 출구 = 맵 맨 아래 줄 틈 한 덩이.)
- **새 가구를 그렸으면** 네 워크트리에서 `python3 scripts/content/jp-city/bake_jp.py` 를 돌려야 검사·렌더가 새 id 를 안다. 굽기 산출물(src/assets/*, public/*, tiledata/jp-city/pins.json·bake-report.json·kit-index.json·refs 등)은 **커밋하지 않는다** — 감독이 합친 뒤 다시 굽는다. 블록 py·예제 json·categories.py(네 가구 id 를 분류에 넣을 때만) 만 커밋한다.
- 실제 그림 확인: `node scripts/content/jp-city/maps/interior.mjs` → `verify-shots/jp-city/interior-<이름>-x2.png` (도구가 지은 진짜 맵). 이것을 크롭해 본다(이 파일도 커밋하지 않는다 — 감독이 다시 렌더한다).
- 빈 바닥: 「공간이 남으면 맵이 너무 큰 것」. 큰 빈 바닥은 먼저 **맵을 줄이고**, 그다음 목적 있는 가구를 넣는다. 의자·화분으로 메우지 않는다. 손님 통로(폭 2칸)는 빈 것이 아니다.
- 핵심 동선은 폭 2칸(손님 통로·탈의실↔욕장·대기실↔진찰실). 직원 전용 뒷길은 1칸 가능.
- 입구: 맨 아래 줄 틈은 **2칸 이상**, 가운데 쪽. 틈 바로 위 1~2줄은 비운다(도착 칸 여유).
- 예제의 `start` = 입구 틈 바로 위 칸. 평면을 바꾸면 start·rooms 도 고친다.
- id 머리는 지난번 네 블록 것을 그대로 쓴다(cv- fd- sh- pb- h2-). 새 가구 id 도 같은 머리.

### 마무리
- 네 블록 py 를 돌려 selftest 실패 0, check-interior-examples 네 예제 OK.
- 커밋(`fix(jp-city): …`, 끝 줄 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`). 굽기 산출물·verify-shots 는 `git add` 하지 않는다.
- 최종 답: 고친 관문 지적 항목별로 무엇을 했는지, 새 가구 id(종류·크기·use·분류 제안), 맵 크기 전→후, 눈으로 본 크롭 경로, 남은 약점(정직하게).
- 금지: npm test·vitest·gates·git stash·git push·ikit.py/preview.py/bake_jp.py/src/** 수정.
