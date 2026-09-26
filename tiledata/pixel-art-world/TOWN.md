# PAW 일본 소도시 96×72 (직접 배치)

- 생성기: `scripts/content/prepare-pixel-art-world-town.py` — PAW 다운로드(`~/.local/share/oprn/pixel-art-world-downloads`)를 읽어 로컬 PNG 로 그린다. 그림은 재배포 금지라 저장소에 넣지 않는다.
- 배치 기록: `town.json` (좌표·키트 id 만, 픽셀 없음).
- 구역: 북서 학교(본관 32×18·체육관·수영장·운동장·정문·자전거 보관), 북동 뒷산·아파트·의원·양옥·주택·공원·상점가, 남서 주택가·센토, 남동 편의점 주차장·밭·지장보살·벚꽃, 남쪽 수로+다리.
- 전부 PAW 기존 타일로만 고쳤다: 수로 SA-Pool01 + guardrail, 밭 SA-Hatake01 + vege, 칩 car/bicycle01/jizo/sakura2/momiji/post/gomi.
- 검사: 입구 29곳 도달 가능, 겹침 없음(claim).
- 남은 약점: 수로 물 끝이 둥글다, 역·철도 타일은 팩에 없다.
