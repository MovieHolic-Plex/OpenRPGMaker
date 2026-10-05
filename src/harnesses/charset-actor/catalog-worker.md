# 에디터 원본 변주 — GPT 6.1 sol high

원본은 에디터 카탈로그의 실제 걷기 칩이다. 사람·몬스터·동물·슬라임·유령·움직이는 물건이 섞인다. 사용자가 GIF로 남기기/폐기를 결정한다.

- pending.json의 각 폴더만 저작한다. base.chr.txt와 base-views/sheet_x8.png를 먼저 읽고 원본의 체형·방향·이동 방식과 catalogReference를 확인한다. 원본/저장소 코드/사용자 선택은 수정하지 않는다.
- base를 out.chr.txt에 복사하고 up/right/down/left × 0/1/2 전체 12장의 실제 픽셀을 직접 다시 찍는다. 색만 일괄 치환하지 않는다. 이미지 생성 API·외부 그림·프레임 전파/합성/자동 보정은 쓰지 않는다.
- 사람은 머리·옷깃·소매·복식의 작은 형태를 바꾼다. 몬스터는 원본 종과 체형을 이어가며 얼굴·재질·무늬·작은 형태를 바꾼다. 슬라임은 압축/늘어남, 유령은 유영과 몸자락, 날짐승은 날개와 연결된 몸의 움직임, 사족 동물은 몸통과 앞/뒷발을 직접 저작한다. 사람 다리를 새로 붙이지 않는다.
- 1은 중간 자세, 0/2는 다른 이동 자세다. 몸통 자체와 하단의 발/몸자락/젤리 가장자리가 실제로 움직여야 한다. 머리/눈/꼬리만 바꾸거나 색만 깜빡이지 않는다. 정지 전체를 통째로 옮겨 복사하지 않는다. 기존 검사 영역은 보행을 증명하는 해부학 분할이 아니며 몸 중앙과 하단의 공간 변화를 요구한다.
- 투명은 '.' 하나다. #009392 RGB 채널 ±8의 색을 몸체에 쓰지 않는다. 원본 밖 장식 안에 투명 구멍을 만들지 말고 프레임 끝에서 머리/날개가 잘리지 않게 한다.
- 지정 폴더에서 아래를 실행하고 오류 좌표의 해당 프레임 행을 직접 고친다. 검사 코드·JSON·원본·프로필을 고쳐 통과시키지 않는다.
  ```
  {TOOL} check characters/KEY__gpt-r1/out.chr.txt --base BASE --strength free
  {TOOL} views characters/KEY__gpt-r1/out.chr.txt characters/KEY__gpt-r1/views --base BASE --strength free
  ```
- views/alpha_sheet.png, sheet_rgba.png, alpha.png, strip.png의 12장과 walk_checker.gif/walk_white.gif/walk_black.gif를 실제로 열어 잘림·투명색·방향 연결을 확인한다. 잔디 위에서만 보지 않는다.
- desc.json: {"label":"이름","gender":"남|여|불명","attributes":{"kind":"사람|몬스터|동물","age":"어린이|청년|중년|노년|불명","hair":"머리·털·몸 표면","clothing":"의상 또는 피부·갑피·재질"},"role":"역할","appearance":"실제로 그린 외형","tags":["계열","재질"],"fits":"용도","by":"GPT 6.1 sol high · 작업자 설명"}. 속성은 80자 이하. 비인간의 나이는 정하지 않았다면 불명이다.
- notes.md에 콘셉트와 아쉬움을 남긴다. 점수로 선별하거나 사용자를 대신해 남기기/폐기하지 않는다. 모든 지정 결과를 완성하고 질문하지 않는다.

## 이번 캐릭터

{ASSIGNMENTS}
