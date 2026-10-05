# 픽셀 원본과 기계적 도구

기존 하네스의 격자 형식이 있으면 그 형식을 우선한다. 이 형식은 전용 도구가 없는 작업의 공통 원본이다.
원본 파일 이름 예: `fire.px.json`. 좌표는 왼쪽 위 `(0,0)`, x는 오른쪽, y는 아래다.

```json
{
  "version": 1,
  "width": 8,
  "height": 8,
  "maxColors": 16,
  "palette": {"A": "#492332", "B": "#eb8234", "C": "#fff1bd"},
  "frames": [{
    "id": "impact",
    "durationMs": 80,
    "rows": [
      "........",
      "...A....",
      "..ABA...",
      "..ACA...",
      ".ABCCA..",
      ".ABBBA..",
      "..AAA...",
      "........"
    ]
  }]
}
```

형식만 설명하는 8px 조각이다. 그림 품질의 기준작이 아니다.

- `.`만 투명이다. 팔레트 키는 출력 가능한 ASCII 한 글자, 색은 명시한 `#RRGGBB`다.
- 모든 행을 width 글자 × height 행으로 쓴다. 여백도 `.`로 쓰고, 반복식이나 그림 함수로 원본을 만들지 않는다.
- 프레임마다 독립된 행 배열을 쓴다. `durationMs`는 10~10000ms 안의10ms 배수다(GIF 시간 단위). 발동 전/소멸 뒤 빈 프레임도 허용한다.
- 크기는 1~512px다. `maxColors`의 기본값은16이며 대상 계약에 맞춰1~64로 지정한다.
  같은 RGB에 다른 기호를 써도 실제 색 수는 RGB로 센다.
- 틈과 빛 입자가 의도일 수 있다. 검사는 원본 픽셀을 자동으로 다시 칠하지 않는다.

## 명령

`TOOL`을 이 스킬 폴더의 `scripts/pixelgrid.py` 실제 절대 경로로 바꾼다.

```bash
python3 TOOL init fire.px.json --size 32 32 --frames 8
python3 TOOL inspect fire.px.json
python3 TOOL inspect fire.px.json --frame f03 --crop 8 4 16 16
python3 TOOL apply fire.px.json patch.json
python3 TOOL render fire.px.json --out review/fire --scale 6
```

init은 투명 빈칸만 만든다. 처음부터 전체 글자 원본을 직접 써도 된다.
inspect는 현재 파일 SHA256, 좌표 붙은 행, RGBA로 센 프레임별 색/차지한 칸/변경량을 보여준다.
`--crop`은 읽기 표시만 바꾼다. inspect/render는 원본을 수정하지 않는다.

## 좌표 패치

inspect에서 받은 현재 해시를 넣고, 찍을 색 글자열을 직접 고른다.

```json
{
  "version": 1,
  "sourceSha256": "inspect에서 출력한 현재 해시",
  "palette": {"D": "#b34438"},
  "ops": [
    {"frame": "f03", "x": 12, "y": 7, "pixels": "ABCD", "before": "...."}
  ]
}
```

가로 한 줄 4px만 바꾼다. 범위 밖/모르는 색/낡은 원본 해시/`before` 불일치는 쓰기 전에 오류가 난다.
팔레트만 추가할 수도 있다. 같은 키의 색을 바꾸면 모든 프레임의 해당 색이 바뀌므로 그 의도를 확인한다.
성공한 패치와 전후 해시를 `<원본이름>.edits.jsonl`에 기록한다. 기록은 직접 저작이나 품질의 증명이 아니다.

## 출력

- `sheet.png`: 원본1배 투명 RGBA, 전체 프레임 가로 띠.
- `contact-native-*.png`: 이름표와 원본 크기로 모든 프레임을 본다.
- `contact-grid-*.png`: 최근접 확대와1px 격자/좌표. 큰 원본은 확대 배율도 제한하며 페이지를 나눈다. 실제 배율은 report에 기록한다.
- `dark.gif` / `light.gif` / `checker.gif`: 같은 원본과 시간표를 세 배경에서 재생한다. GIF는 무음이다.
- `report.json`: 원본/출력 해시, 크기, 프레임별 색 수/차지한 칸 경계/실제 픽셀 차이와 시간표.

PNG는 행의 기호를 RGBA로 일대일 바꾼다. 확대/격자/글자/배경은 확인판에만 붙인다.
GIF 팔레트도 원본 색과 배경 색에서 만들고 블러/리샘플링/자동 색 축소로 원본을 바꾸지 않는다.
Pillow가 필요하다. 기존 작업 환경의 Python으로 실행한다.
