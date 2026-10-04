너는 16px 도트 작가다. 생성 그림을 기계로 줄인 도트를 **손질**한다. 도구는 Read·Write 만 쓴다.

대상: vending_ice (22×29px). 현대 일본 도심 RPG 맵 소품(역 앞 번화가, 채도 낮게), 빛은 왼쪽 위.
1. Read tiledata/atlas-pick/h-method/jp/work/vending_ice-srcs.png — 원래 생성 그림(참고만, 크게 줄이기 전 모습).
2. Read tiledata/atlas-pick/h-method/jp/work/vending_ice-zoom.png — 지금 도트를 12배 확대한 것(격자 4칸마다 진한 선).
3. Read tiledata/atlas-pick/h-method/jp/work/vending_ice-c.txt — 지금 도트의 글자 격자. 한 글자 = 한 픽셀. '.' = 투명.
   색 글자(어두움→밝음): '#'=#7c4114, '@'=#2d4a8c, '%'=#a81e82, '&'=#5690dc, '='=#f2cc3a, '*'=#8ad0a0, '+'=#f6a882, '$'=#f478cc, '~'=#b0f2f2, ':'=#f4eedc

할 일: 같은 크기(22열 × 29줄), 같은 글자만 써서 손질한 격자를 Write tiledata/atlas-pick/h-method/jp/work/vending_ice-post.txt 에 쓴다(격자만, 다른 글 없이).
그다음 Write tiledata/atlas-pick/h-method/jp/work/vending_ice-notes.md 에 무엇을 고쳤는지 한국어 5줄 이내.

손질 기준(도트 작가가 하는 일):
- 외곽선: 바깥 윤곽을 끊김 없는 한 겹으로. 계단이 들쭉날쭉한 곳(1-2-1-3 같은)을 고른 계단으로. 윤곽 바깥에 떨어진 외톨이 점은 지운다.
- 잡티: 넓은 면 안의 외톨이 한 점·체크무늬 얼룩을 없애고 면을 깨끗이. 명암 덩어리는 왼쪽 위가 밝고 오른쪽 아래가 어둡게 정돈.
- 작은 정보는 살린다: 창·불빛·버튼·바퀴·얼굴처럼 1~2px 정보가 뭉개졌으면 읽히게 다시 찍는다. 좌우 대칭인 물건은 대칭을 맞춘다.
- 모양·크기·시점은 바꾸지 마라. 글자 격자 밖 새 글자 금지. 줄 수·열 수가 정확해야 한다.
- 윗면(가장 밝은 단)과 앞면 구분을 지켜라. 윗면 띠를 앞면 색으로 덮거나 지우지 마라.
