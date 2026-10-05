# 동물 기반 필드 몬스터 공방 — GPT 6.1 sol high

24×32 몬스터의 네 방향 정지 4장과 걷기 8장을 네가 직접 도트로 찍는다. 사용자만 걷는 GIF를 보고 남김/폐기를 결정한다.
원본은 Animal.png의 개·고양이·닭·양·소·말·호랑이·사자다. 작은 동물의 볼륨과 걸음 연결을 바탕으로 독창적인 몬스터를 만든다.

## 제작 계약

- pending.json의 지정 폴더만 편집한다. base.chr.txt와 base-views/sheet_x8.png를 읽고 원본 격자는 보존한다.
- out.chr.txt의 up/right/down/left × 0/1/2 **12장 전부를 직접 작성**한다. 정지1, 반대 발 걸음0·2다. 각 장의 실제 RGBA는 원본과 달라야 한다. 색만 일괄 치환하지 말고 귀·뿔·주둥이·등판·털·갈기·꼬리 등의 형태와 명암을 직접 정한다.
- assignments의 가족과 몸 비율을 유지한다. 개/고양이 계열은 낮은 사족보행, 닭 계열은 조류의 두 발, 큰 짐승은 앞발·뒷발과 몸의 무게가 읽혀야 한다. 사람 옷·사람 다리로 만들지 않는다. 작은 크기에 장식을 과하게 붙이지 않는다.
- 0→1→2→1에서 몸통의 무게 이동과 발의 반대 걸음을 함께 찍는다. 옆 방향 앞발·뒷발이 모두 교대해야 한다. 앞/뒤 방향에서는 겹친 발 대신 실제 보이는 발을 검사한다. 머리·꼬리·날개만 흔들고 몸통/발을 고정하지 않는다. 정지 전체를 내려 복사한 그림이나 색 깜빡임은 걷기가 아니다.
- animalProfile.directions에 표시한 몸통/발 영역은 **원본 기준으로 제작 전에 고정**되었다. 검사에 맞추려고 원본·프로필·코드·진단 JSON을 고치지 않는다. 이 영역 안에서 같은 몬스터의 연결된 몸과 발을 직접 그린다.
- 팔레트 투명은 '.'만 쓴다. #009392와 RGB 채널 각각 ±8 범위 색은 몸에 쓰지 않는다. 몸 안에 투명 구멍을 만들지 않는다. 눈/뿔/꼬리/발이 프레임 끝에서 잘리거나 떠 있는 픽셀이 생기지 않게 한다.
- 팔레트/원본 격자의 읽기·복사는 코드로 가능하지만 형태와 걷기 행은 직접 작성한다. propagate·걷기 합성·이미지 생성 API·외부 그림은 사용하지 않는다.
- 각 후보에 실행한다(KEY/BASE는 assignment 값):
  ```
  {TOOL} check characters/KEY__gpt-r1/out.chr.txt --base BASE --strength free
  {TOOL} views characters/KEY__gpt-r1/out.chr.txt characters/KEY__gpt-r1/views --base BASE --strength free
  {TOOL} motion-check characters/KEY__gpt-r1/out.chr.txt --base BASE
  ```
- views/alpha_sheet.png, sheet_rgba.png, alpha.png, strip.png의 **12프레임 전부**를 직접 본다. walk_checker.gif·walk_white.gif·walk_black.gif와 motion.png·느린 motion.gif도 직접 확인한다. 검사 실패는 해당 방향/걸음 행을 직접 고친 후 다시 실행한다. 자동 픽셀 채우기/전파나 검사 증거 편집은 금지한다.
- desc.json: {"label":"몬스터 이름","gender":"불명","attributes":{"kind":"동물형 몬스터의 종류","age":"성체|유체|불명","hair":"실제로 그린 털·깃털·갈기·비늘","clothing":"옷 없음; 실제 갑피·등판·장식"},"role":"필드 몬스터 역할","appearance":"실제로 그린 외형","tags":["동물 계열","속성"],"fits":"서식지/게임 용도","by":"GPT 6.1 sol high · 작업자 설명"}. 각 속성은 80자 이하. 설정은 관찰 사실로 포장하지 않는다.
- notes.md에 콘셉트와 아쉬움을 적고 지정 후보를 완성한다. 미감 점수나 남김/폐기 판단은 작성하지 않는다. 저장소 코드·다른 후보·사용자 선택은 편집하지 않는다. 질문하지 말고 완성한다.

## 이번 후보

{ASSIGNMENTS}
