너는 16px 도트 작가다. 생성 그림을 기계로 줄인 도트를 **손질**한다. 도구는 Read·Write 만 쓴다.

대상: traffic_light (32×48px). 현대 도시 RPG 맵 소품, 빛은 왼쪽 위.
1. Read tiledata/atlas-pick/ascii-pixelize/post/traffic_light-src.png — 원래 생성 그림(참고만, 크게 줄이기 전 모습).
2. Read tiledata/atlas-pick/ascii-pixelize/post/traffic_light-zoom.png — 지금 도트를 12배 확대한 것(격자 4칸마다 진한 선).
3. Read tiledata/atlas-pick/ascii-pixelize/traffic_light.txt — 지금 도트의 글자 격자. 한 글자 = 한 픽셀. '.' = 투명.
   색 글자(어두움→밝음): '@'=#12173d, '#'=#801223, '%'=#39536b, '&'=#856437, '*'=#db4d4a, '$'=#6d7494, '='=#eb8e4f, '+'=#e043a7, '~'=#aba4b8, ':'=#e0dbb7

할 일: 같은 크기(32열 × 48줄), 같은 글자만 써서 손질한 격자를 Write tiledata/atlas-pick/ascii-pixelize/post/traffic_light.txt 에 쓴다(격자만, 다른 글 없이).
그다음 Write tiledata/atlas-pick/ascii-pixelize/post/traffic_light.notes.md 에 무엇을 고쳤는지 한국어 5줄 이내.

손질 기준(도트 작가가 하는 일):
- 외곽선: 바깥 윤곽을 끊김 없는 한 겹으로. 계단이 들쭉날쭉한 곳(1-2-1-3 같은)을 고른 계단으로. 윤곽 바깥에 떨어진 외톨이 점은 지운다.
- 잡티: 넓은 면 안의 외톨이 한 점·체크무늬 얼룩을 없애고 면을 깨끗이. 명암 덩어리는 왼쪽 위가 밝고 오른쪽 아래가 어둡게 정돈.
- 작은 정보는 살린다: 창·불빛·버튼·바퀴·얼굴처럼 1~2px 정보가 뭉개졌으면 읽히게 다시 찍는다. 좌우 대칭인 물건은 대칭을 맞춘다.
- 모양·크기·시점은 바꾸지 마라. 글자 격자 밖 새 글자 금지. 줄 수·열 수가 정확해야 한다.

쓴 뒤 반드시 Read 로 다시 열어 줄 수와 모든 줄의 글자 수가 정확한지 다시 확인하고, 틀리면 고쳐 다시 Write 한다. (지난번 시도에서 줄 수·줄 길이가 어긋났다.)
