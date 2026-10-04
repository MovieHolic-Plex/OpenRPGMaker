# 자유 캐릭터 공방 — GPT 6.1 sol high

지정된 각 폴더에 에디터용 24×32 캐릭터를 직접 도트로 만든다. 미감의 최종 판단은 사용자가 걷는 GIF를 보고 한다.
인물·직업·장르·나이·머리·의상·모자·작은 소품을 네가 자유롭게 정한다. assignments의 brief는 전체 방향이며 개별 인물의 정답이 아니다.
같은 묶음의 사람은 다양한 실루엣·의상·색·역할을 갖게 한다. 한국풍·판타지·현대·SF를 섞어도 된다.

## 작업 계약

- pending.json에 지정된 각 폴더의 base.chr.txt와 base-views/sheet_x8.png를 읽는다. 유일한 픽셀 원본이다. 원본 파일은 수정하지 않는다. assignments.json에는 이미 완성된 사람이 섞일 수 있으므로 pending.json에 없는 사람은 편집하지 않는다.
- base를 out.chr.txt에 복사하고 **서 있는 네 방향(up/right/down/left 1)**의 ASCII 행을 직접 다시 찍는다. 색만 일괄 치환하지 않는다.
- 원본 머리 내부·눈·손발 위치를 유지해 정상적인 몸체를 만든다. 원본 복식·색·직업·윤곽 주변 장식은 자유롭게 바꾼다.
- 모자와 소품도 가능하다. 24×32 프레임 위/옆 끝에서 잘리지 않게 여유를 둔다. 목·옷 안에 투명 구멍을 뚫지 않는다.
- 팔레트의 투명은 '.' 하나다. #009392와 각 RGB 채널 ±8의 색을 몸체에 쓰지 않는다.
- 팔레트/프레임의 기계적 읽기·복사는 스크립트로 가능하다. 머리/옷의 형태는 직접 작성한 행으로 정한다. 이미지 생성 API나 외부 그림을 쓰지 않는다.
- 각 결과에 아래를 실행한다. BASE는 assignment의 base 값이다.
  ```
  {TOOL} propagate characters/KEY__gpt-r1/out.chr.txt --base BASE --strength free
  {TOOL} views characters/KEY__gpt-r1/out.chr.txt characters/KEY__gpt-r1/views --base BASE --strength free
  ```
- views/alpha_sheet.png(자홍색 체커), views/sheet_rgba.png, views/alpha.png와 views/strip.png를 직접 열어 **12프레임 전부**를 확인한다. 걷기 GIF는 views/walk_checker.gif·walk_white.gif·walk_black.gif로 배경을 바꿔 본다. 잔디 위에서만 확인하고 끝내지 않는다.
- 원본 밖에 추가한 옷·모자·장식 안의 1px 투명 점도 불합격이다. 팔·다리 사이 배경을 새 윤곽으로 둘러싸 닫힌 구멍으로 만들지 않는다. 머리 깊은 면을 배경으로 연결하는 좁은 틈도 금지한다. 검사 실패는 **직접 찍은 행**을 고쳐 전파·views를 다시 실행한다. 자동으로 빈 곳을 채우거나 검사 JSON만 바꿔 통과시키지 않는다.
- 각 폴더에 desc.json을 쓴다: {"label":"인물 이름","gender":"남|여|불명","attributes":{"kind":"사람","age":"어린이|청년|중년|노년|불명","hair":"머리 모양·색","clothing":"의상 종류·색"},"role":"역할","appearance":"실제로 그린 외형","tags":["장르","복식"],"fits":"쓰임","by":"GPT 6.1 sol high · 작업자 설명"}. age는 네가 선택한 캐릭터 설정이며 실제 나이를 그림으로 확정한 관찰값이 아니다. 모르면 불명으로 쓴다. 각 속성 문자열은 80자 이하다.
- notes.md에 선택한 콘셉트와 아쉬움을 적는다. 모든 지정된 사람의 결과를 남긴다.

후보를 PASS/FAIL 점수로 선별하거나 사용자를 대신해 남기기/폐기하지 않는다. 별도 모델 미감 심사도 없다.
작업 폴더 안의 지정된 사람만 편집하고 저장소 코드/다른 묶음/사용자 결정은 건드리지 않는다. 질문하지 말고 완성한다.

## 이번 묶음

{ASSIGNMENTS}
