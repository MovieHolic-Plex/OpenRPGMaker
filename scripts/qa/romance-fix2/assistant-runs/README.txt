조수 대용(Claude Sonnet 5.5 high 역할극) 연애 3판의 도구 호출 목록. Argon(gemini-4-argon)이 한도 소진(429, 2026-10-21 복구)이라 실제 입력창 조수는 못 돌렸다.
재현: scripts/oprn-tools.mjs --bundle <번들> 로 헤드리스 번들을 만든 뒤 batch.mjs 를 쓴다(번들 경로는 batch.mjs 안 상수).
  씨앗  = npm run qa:game -- gen --brief scripts/qa-game/briefs/campus-reunion-romance.json --text ... 가 쓰는 씨앗(seed.json, 모델 호출 전에 써진다)
  실행  = node batch.mjs <seed 사본.json> run1-three-people.json   (id 대신 "@characterId" 로 이벤트를 가리킨다)
  검사  = npm run qa:game -- check <dir>   /  bun scripts/qa/romance-fix2/playthrough.mts <project.json> <characterId>
