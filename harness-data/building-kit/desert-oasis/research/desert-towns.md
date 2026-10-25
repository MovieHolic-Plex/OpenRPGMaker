# 사막 마을·오아시스 도시의 2D 픽셀 RPG 건축 문법 — 조사 노트

작성 목적: `building-kit` desert-oasis 테마가 「평지붕 상자 + 돔 하나」에서 벗어나도록,
게임 사례와 실제 사막 건축의 유형·요소·배치 원리를 근거와 함께 정리한다.
이 문서는 원리만 담는다. 어떤 게임의 실제 픽셀·시트도 복제하지 않는다(§5).

근거 표기: **[확인]** = 아래 인용 문서가 직접 서술. **[추정]** = 시리즈 관례·스크린샷 일반형에서 온 해석으로, 굽기 전 육안 대조 필요.

---

## 1. 게임 → 마을 → 건물·요소·색·소품

| 게임 | 마을/장소 | 등장 건물·요소 | 색·소품 메모 | 출처 |
|---|---|---|---|---|
| FF IV | Kaipo (Damcyan 사막, 오아시스 옆) | 여관(2층에 술집), 아이템·무기·방어구 상점, 부부의 집, 오아시스 물가. 마을이 사막 한가운데 오아시스에 붙어 있음 [확인] | 사막+오아시스 이중 바닥. 여관·상점·주택이 기능별로 분리된 작은 마을 [확인]. 지붕 형태는 [추정] 평지붕 | https://finalfantasy.fandom.com/wiki/Kaipo |
| FF IV | Damcyan (사막 공국) | 사막 공국, 성이 중심, Kaipo를 영역에 포함 [확인] | 성+오아시스 마을의 위계 [확인] | https://finalfantasy.fandom.com/wiki/Damcyan |
| FF V | Karnak | 성벽으로 육로가 막힌 마을, 거리 곳곳에 서 있는 횃불(불에 닿으면 튕겨 나감), 성의 화염 크리스탈 발전 [확인] | 벽으로 닫힌 도시 + 노상 화로가 실루엣 포인트 [확인] | https://finalfantasy.fandom.com/wiki/Karnak |
| FF V | Desert of Shifting Sands | 흐르는 모래(도보 통행 불가), 사막 한가운데 피라미드 [확인] | 마을이 아닌 「사막 지형」 문법: 유동 모래·매몰 유적 [확인] | https://finalfantasy.fandom.com/wiki/Desert_of_Shifting_Sands |
| FF VI | Figaro Castle | 사막 위 성. 석재 블록·성벽·탑, 탑에 터빈이 지나감 [확인] | 사막 + 중세 석축 + 기계 = 대비되는 재료 [확인] | https://finalfantasy.fandom.com/wiki/Figaro_Castle |
| FF VI | (주의) Kohlingen·South Figaro | South Figaro는 **항구 도시**로 사막 마을이 아님 [확인]. Figaro 왕국이 Figaro Castle과 South Figaro를 관할 [확인] | 사막 마을 사례로 쓰면 안 됨 | https://finalfantasy.fandom.com/wiki/South_Figaro |
| Chrono Trigger | Fiona's Villa / Sunken Desert (600 AD) | 사막화된 땅의 오두막 하나 + 함몰 사막(모래 구덩이) [확인] | 「마을 이전 단계」 = 집 1채·우물·모래 균열. 복원 후 숲이 됨 [확인] | https://chrono.fandom.com/wiki/Fiona%27s_Villa · https://chrono.fandom.com/wiki/Sunken_Desert |
| Chrono Trigger | Porre | Zenan 대륙 남단의 큰 도시 [확인] — 사막 도시로 단정할 근거 없음 | 사막 사례로 쓰지 말 것 | https://chrono.fandom.com/wiki/Porre |
| DQ IV | Desert Bazaar | **유목 시장**: 천막·노점이 모인 임시 상설 시장, 챕터 2에서만 존재하고 이후 이동 [확인] | 「건물 없는 마을」 — 천막만으로 성립하는 정착지 [확인] | https://dragonquest.fandom.com/wiki/Desert_Bazaar |
| DQ XI | Gallopolis (사마디) | 술탄국 성하 마을, 경마·사막 기사, 저녁 서커스 [확인]. 아라비아 반도 문화 모델 [확인] | 성 + 경기장 + 시장의 3층 구조 [확인] | https://dragonquest.fandom.com/wiki/Gallopolis |
| Secret of Mana | Kakkara | 사막 북쪽 마을, 마을 오아시스가 마름(마나 시드 상실), 복원 퀘스트 [확인] | 「오아시스가 마르는」 상태 변화 = 같은 마을의 두 버전 [확인] | https://mana.fandom.com/wiki/Kakkara_(town) |
| Golden Sun | Lalivero | Gondowan 북부 마을, 등대 두 기 사이, 지형이 나일 델타 유사 [확인] | 등대(수직 랜드마크) + 마을 [확인] | https://goldensun.fandom.com/wiki/Lalivero |
| Golden Sun | Kalay | 「중동풍 디자인」의 번성한 항구 도시 [확인] | 사막권 문화권의 색·지붕 문법 참고 [확인] | https://goldensun.fandom.com/wiki/Kalay |
| Octopath Traveler | Sunshade | **adobe 건물**, 도시 절반이 거대 암벽 그늘에 영구히 덮임, 거리 위로 **천막이 늘어져** 그늘 주머니를 만듦, 시장→여관(술집) 동선, 동쪽에 무희 막사·무기점, 서쪽에 여관·잡화·지하 묘지 입구 [확인] | 밝은 햇빛 절반 / 영구 그늘 절반 = 같은 재료의 두 조명 [확인] | https://octopath-traveler.fandom.com/wiki/Sunshade |
| Octopath Traveler | Wellspring | 오아시스 마을, 사막 여행자의 물 공급 거점, 고대부터 번성, 교역 허브 [확인] | 「물이 곧 시장」 — 오아시스 둘레 상업 [확인] | https://octopath-traveler.fandom.com/wiki/Wellspring |
| Octopath Traveler | Sunlands (지역 규칙) | 도시들이 **큰 암벽 그늘 아래** 또는 **오아시스 둘레**에 자리 잡음, 드문 선인장 [확인] | 지역 단위 배치 규칙으로 그대로 쓸 수 있음 [확인] | https://octopath-traveler.fandom.com/wiki/Sunlands |
| Stardew Valley | Calico Desert / Oasis | 사막 상점(Oasis) 1채, 북서쪽 연못, 상인+낙타, 광산 입구 [확인] | 「건물 1 + 연못 1 + 상인 1」 최소 사막 거점 [확인] | https://stardewvalley.fandom.com/wiki/Calico_Desert · https://stardewvalley.fandom.com/wiki/Oasis |
| Pokémon SV | Cascarrafa | 사막권 도시, 중심 분수 광장, 체육관(물) [확인] | 분수=오아시스의 도시판 치환 [확인] | https://www.serebii.net/pokearth/paldea/cascarrafa.shtml |
| RPG Maker (상용 팩) | FSM "Desert Town and Ruins Tiles" | 사막 마을 + 유적을 한 팩으로 묶음 [확인] | 시장에서 「마을/유적」이 한 세트로 팔린다는 것 = 두 변형이 한 문법 [확인] | https://store.steampowered.com/app/1617500/ |
| RPG Maker (상용 팩) | Winlu "Desert Exterior / Interior" | 사막 외부·내부를 분리 판매 [확인] | 외부(광장·가옥)·내부(방·가구) 문법 분리 [확인] | https://store.steampowered.com/app/2801110/ |

### 조사 중 확인된 「사실 정정」
- FF VI의 사막 거점은 **Figaro Castle**이고, Kohlingen·South Figaro는 사막 마을이 아니다(South Figaro는 항구). [확인]
- FF V의 사막 마을은 Karnak이 아니라 Karnak은 성벽 도시이며, 사막 자체는 Desert of Shifting Sands다. Karnak을 「사막 마을」로 쓰려면 벽·화로 중심으로 써야 한다. [확인]
- Chrono Trigger에는 「사막 마을」이 없다. Fiona's Villa는 사막화 지역의 오두막 1채이고, Zenan 사막은 마을이 아니라 지형이다. [확인]
- Sea of Stars·Eastward는 사막 마을 근거를 찾지 못했다(공식/위키 문서에 해당 지역 서술 없음). 이 문서에서는 사례로 쓰지 않는다.

---

## 2. 실제 사막 건축 — 게임이 차용하는 원형

| 원형 | 구조적 사실 | 16px 3/4 탑뷰로 옮길 때의 핵심 | 출처 |
|---|---|---|---|
| Ghadames (리비아 오아시스) | 수직 기능 분리: 1층 저장, 2층 주거, **골목 위를 덮는 돌출부**로 거의 지하 통로망, 꼭대기는 여성용 노천 테라스 [확인] | 「골목 덮개」 = 지붕면과 골목 그늘을 동시에 그리는 조각. 상층이 하층보다 튀어나옴 | https://en.wikipedia.org/wiki/Ghadames |
| Shibam (예멘) | 흙벽돌 **고층**(최대 11층), 방어 목적의 밀집 고층 [확인] | 한 칸 폭에 3~4층을 쌓는 「수직 밀도」 변형. 창이 위로 갈수록 작아짐 | https://en.wikipedia.org/wiki/Shibam |
| Aït Benhaddou (모로코 ksar) | 성벽 + **모서리 탑** + 성문, 흙다짐(rammed earth)·adobe·흙벽돌·목재, 상부에 기하 문양, 모스크·**카라반사라이**·카스바·언덕 위 **곡창(agadir)** [확인] | 성벽+모서리 탑+문 3종 세트, 상부 문양 띠, 언덕 위 별도 실루엣 | https://en.wikipedia.org/wiki/Aït_Benhaddou |
| Siwa / Shali Ghadi (이집트) | 소금+흙벽돌(kershif)과 **야자수 들보**, 5층 높이의 언덕 요새, 비로 붕괴 후 평지로 이주 [확인] | 「폐허 변형」의 정본: 같은 재료가 반쯤 무너진 상태 | https://en.wikipedia.org/wiki/Siwa_Oasis |
| Yazd (이란) | 「바람탑의 도시」, 카나트·아브안바르(저수조)·야크찰(빙고) [확인] | 바람탑 = 지붕면 위로 솟는 사각 굴뚝 실루엣 | https://en.wikipedia.org/wiki/Yazd |
| Windcatcher (바드기르) | 단방향/양방향/다방향 설계, 높이·단면·내부 칸막이가 다양 [확인] | 상단이 열린 사각 탑. 위에서 보면 「ㅁ + 칸막이」 | https://en.wikipedia.org/wiki/Windcatcher |
| Qanat | 경사 지하 수로 + 지표에 **일정 간격 수직 환기구(우물 입구)** [확인] | 사막 바닥에 규칙적으로 늘어선 작은 구멍 줄 = 값싼 반복 소품 | https://en.wikipedia.org/wiki/Qanat |
| Caravanserai | 직사각형, **보호된 입구 하나**, 중앙 안뜰, 그 둘레에 방·마구간·창고 [확인] | 「문 하나 + 안뜰」 = 사막 마을의 관문 건물 | https://en.wikipedia.org/wiki/Caravanserai |
| Bazaar / souk | **아치 덮인 거리**, 양 끝에 문, 도시 중앙 시장 [확인] | 거리 자체가 건물: 아치열 + 양 끝 문 | https://en.wikipedia.org/wiki/Bazaar |
| Mashrabiya | 상층의 돌출 목재 격자창, 통풍·증발냉각 [확인] | 벽 조각에 「격자 무늬 창 + 살짝 돌출」 | https://en.wikipedia.org/wiki/Mashrabiya |
| Pueblo (미국 남서부) | adobe·석조 **다층 집합**, 열린 광장을 둘러쌈, 사다리로만 오르는 방 [확인] | 광장을 둘러싼 2~3층 띠 + 지붕 위 사다리 | https://en.wikipedia.org/wiki/Pueblo |
| Viga | adobe 지붕의 **들보 끝이 벽 밖으로 튀어나옴**, 상부에 latillas [확인] | 벽 상단 1행에 일정 간격 점 3~5개 = 즉시 「adobe」로 읽힘 | https://en.wikipedia.org/wiki/Viga_(architecture) |
| Courtyard house / riad | 주요 방이 중앙 안뜰을 둘러쌈, 외벽은 창 없이 반쯤 요새화 [확인] | 지붕면 가운데를 뚫어 안뜰(야자·물)을 보여주는 조각 | https://en.wikipedia.org/wiki/Courtyard_house |
| Kasbah | 요새·성채, 파생 의미로 감시탑·블록하우스 [확인] | 테이퍼진 벽 + 상단 총안 | https://en.wikipedia.org/wiki/Kasbah |
| Bedouin | 목축 반유목, 천막 문화 [확인] | 천막은 「건물」이 아니라 「이동하는 건물」 — 마을 외곽에 배치 | https://en.wikipedia.org/wiki/Bedouin |

---

## 3. 그릴 만한 건물 유형과 요소 카탈로그 (3/4 탑뷰 16px)

각 항목: 실루엣/매싱 → 3/4 위에서 읽히는 방식.

### 3.1 건물 유형
1. **천막 (tent)** — 원뿔 또는 낮은 사각 지붕 + 중앙 기둥. 위에서 보면 삼각/사다리꼴 천 조각 + 세로 줄무늬. 줄무늬는 2색 교대(예: awning 램프 + whitewash 램프). [근거: Bedouin 천막 문화 / DQ IV Desert Bazaar의 천막 시장]
2. **평지붕 흙벽돌 집 (1층)** — 폭 4칸, 벽 2행, 지붕 3행, 난간. 위에서 보면 **난간 윗면 띠 + 평평한 지붕 면 + 처마 그늘** 3층 띠. [근거: Ghadames 테라스 / 프로젝트 seed.json `roof.flat`]
3. **계단식 2층 집 + 외부 계단** — 2층 질량을 한 칸 물리고, 그 물린 자리에 계단을 붙임. 위에서 보면 ㄱ자 지붕 윤곽 + 계단의 사선 줄. [추정 — Ghadames 상층 돌출·Pueblo 다층에서 파생]
4. **지붕 테라스 연결 집** — 이웃 지붕과 지붕을 잇는 난간 낮은 다리. 위에서 보면 지붕 면이 **마을 블록 단위로 이어지는 큰 면**이 됨. [근거: Ghadames 골목 위 통로 / Shibam 고층 밀집]
5. **바람탑 (windcatcher)** — 지붕면 위로 솟는 사각 탑, 상단이 열림. 위에서 보면 어두운 「ㅁ」 테두리 + 안쪽 칸막이 선. [근거: Yazd·Windcatcher]
6. **미나렛/감시탑** — 가는 원통 또는 각柱 + 상단 발코니. 위에서 보면 작은 원 + 그 주변 그림자 고리. 마을 실루엣의 유일한 수직선. [근거: Kasbah 감시탑 / Lalivero 등대형 랜드마크]
7. **드럼 위 돔** — 돔은 지붕면 위에 얹힌 반구가 아니라 **드럼(원통) + 반구**로 그려야 위에서 반구의 밝은 정점이 보임. [근거: 프로젝트 seed.json `temple` = body + drum 두 질량]
8. **아케이드/콜로네이드 정면** — 1층 앞면에 기둥 3~4개, 그 뒤가 그늘. 위에서 보면 지붕 처마 아래 **어두운 띠 + 밝은 기둥 점**. [근거: Bazaar 아치 거리]
9. **안뜰 주택 (courtyard house)** — 지붕면 한가운데 구멍, 그 안에 야자·물·계단. 위에서 보면 「도넛 지붕」. 가장 강력한 다양성 요소. [근거: Courtyard house / riad]
10. **카스바 모서리 탑 + 테이퍼 벽** — 성벽 네 모서리에 살짝 넓은 탑, 벽은 위로 갈수록 좁아짐. 위에서 보면 성벽이 **이중선**(안쪽 면 + 바깥 면)으로 보임. [근거: Aït Benhaddou 성벽+모서리 탑]
11. **시장 천막·어닝이 길을 덮음** — 건물이 아니라 **거리 위 조각**. 위에서 보면 줄무늬 천 띠가 골목을 가로지르고 그 아래 바닥이 어두움. [근거: Sunshade 「거리 위로 천막이 늘어져 그늘 주머니」]
12. **카라반사라이 문** — 큰 아치 하나 + 좌우 탑, 안뜰이 보임. 위에서 보면 「문 하나 + 사각 안뜰 + 주변 방 띠」. [근거: Caravanserai]
13. **우물/오아시스 못** — 물 면 + 야자 2~3그루 + 물길. 위에서 보면 **청록/남색 면**이 사막 바닥에서 유일한 색 대비. [근거: Kaipo 오아시스 / Kakkara 마른 오아시스 / Wellspring]
14. **성벽 + 성문** — 성벽은 1칸 폭, 위에 총안. 문은 2칸 아치. 위에서 보면 성벽 위면(밝은 띠)과 바깥 그림자(어두운 띠)가 나란함. [근거: Aït Benhaddou / Karnak 성벽]
15. **매몰·폐허 변형** — 같은 건물의 지붕 일부가 모래로 덮이고 난간이 끊김. 위에서 보면 지붕 면이 **모래색으로 반쯤 침식**된 대각선 경계. [근거: Siwa Shali 붕괴 / FSM Desert Town and Ruins]
16. **곡창(agadir) 언덕 요새** — 마을과 분리된 언덕 위 작은 요새. 위에서 보면 마을 지붕면보다 **한 단 위**에 놓인 작은 성. [근거: Aït Benhaddou]
17. **저수조(ab anbar) / 빙고(yakhchal)** — 땅에 반쯤 묻힌 돔. 위에서 보면 지붕 돔의 **아래 절반이 지면에 잘린** 형태. [근거: Yazd]
18. **묘지·성인 묘(marabout)** — 흰 회칠 작은 사각 + 돔. 위에서 보면 whitewash 램프만으로 이루어진 가장 밝은 조각. [근거: Aït Benhaddou 공동 묘지·marabout]

### 3.2 표면·부품 요소
- **비가(viga) 들보 끝**: 벽 상단 1행, 3~5px 간격 점. [Viga]
- **마쉬라비야 격자창**: 창 조각 안에 2×2 격자, 살짝 돌출. [Mashrabiya]
- **총안(crenellation)**: 지붕·성벽 상단의 규칙적 이빨. [Kasbah / 프로젝트 `roof.crenel`]
- **아치 문 vs 사각 문**: 아치는 성스러운 건물·카라반사라이, 사각은 주택. 한 마을에 두 문형을 섞어 위계를 만든다. [추정 — Bazaar 아치 거리·주택 문 일반형]
- **상부 기하 문양 띠**: 벽 최상단 1~2행에 2색 교대. [Aït Benhaddou]
- **층 띠(처마돌림)**: 2층 이상에서 층 사이 밝은 선. [프로젝트 `band`]
- **지붕 위 소품**: 물 항아리, 말린 야자 잎, 빨래줄, 사다리. 위에서 보면 지붕 면에 작은 점·선. [추정 — Ghadames 테라스 생활]
- **바닥 그림자**: 건물 남쪽(아래) 1~2행. 사막에서는 그림자가 **짧고 진함**(정오) 또는 **길고 파람**(저녁) 두 버전. [추정]

### 3.3 색 변형 (같은 매싱, 다른 재료)
프로젝트 `palette.json`의 램프를 그대로 쓴다:
- **adobe** (따뜻한 흙벽돌) — 기본 주택. [palette: adobe]
- **sandstone** (마름 사암) — 사원·공공 건물. [palette: sandstone]
- **whitewash** (흰 회칠) — 사당·묘·부유층 집. [palette: whitewash]
- **dome** (청록) — 사원 돔만. 남용 금지. [palette: dome]
- **awning** (붉은 천) — 시장 천막·차양만. [palette: awning]
- **wood / iron** — 문·들보·난간·등. [palette: wood, iron]

색 변형은 **매싱을 바꾸지 않고** 램프만 바꾸는 것이 핵심이다. 같은 집 조각 3벌(adobe/sandstone/whitewash)로 마을의 3분의 1씩 다른 구역을 만든다. [추정 — 실제 도시의 재료 위계에서 파생]

---

## 4. 마을 배치·매싱 패턴 (빌리지 컴포저용)

1. **오아시스 중심 방사형** — 물 하나 + 그 둘레 시장·여관·사원. 물에서 멀어질수록 주택. [근거: Kaipo·Wellspring·Stardew Oasis]
2. **암벽 그늘 띠** — 큰 암벽 하나를 두고 그 그림자 쪽에 건물 밀집, 햇빛 쪽은 빈 광장·시장. 같은 마을에 **두 조명 구역**이 생긴다. [근거: Sunshade / Sunlands]
3. **성벽 + 문 하나 + 안뜰** — 카라반사라이를 마을 입구에 두고, 안쪽은 좁은 골목. [근거: Caravanserai / Aït Benhaddou]
4. **덮인 골목(dark alley)** — 폭 1칸 골목 위를 상층 돌출부·천막이 덮음. 위에서 보면 **골목이 지붕에 가려지고 입구만 보임**. 통행은 되지만 시각적으로 어두운 실선. [근거: Ghadames / Sunshade 천막]
5. **지붕 테라스 네트워크** — 지붕끼리 난간 낮은 다리로 연결. 플레이어가 지붕 위를 걸을 수 있는 마을. [근거: Ghadames 테라스·골목 위 통로]
6. **수직 밀도 블록** — 좁은 필지에 3~4층을 붙여 세움. 위에서 보면 지붕 면이 작고 **벽 그림자가 길게** 보임. [근거: Shibam]
7. **언덕 위 랜드마크** — 마을과 분리된 언덕에 곡창·요새·등대. 마을 실루엣의 유일한 높이 차. [근거: Aït Benhaddou agadir / Lalivero 등대]
8. **바닥의 반복 리듬** — 카나트 수직구멍·물길·모래 능선을 16px 주기로 반복해 빈 사막을 채운다. [근거: Qanat]
9. **이동하는 외곽** — 마을 경계에 천막·가축 우리·낙타를 배치해 「정착/유목」 경계를 만든다. [근거: Bedouin / DQ IV Desert Bazaar]
10. **마른 상태 / 복원 상태 두 버전** — 같은 마을을 물 있음/없음으로 두 번 굽는다. [근거: Kakkara 오아시스 마름→복원]

### 매싱 규칙 (프로젝트 규칙과 정합)
- 한 채는 **질량 2~3개 합성**: 앞 질량(depth 0)이 뒤 질량(depth 1)을 덮는다. [seed.json `massing`]
- 문은 건물 전체에 **정확히 하나**, 맨 아래 층, 문 앞은 걸음 칸. [seed.json `door`]
- 층마다 벽 재질을 바꿀 수 있다(1층 adobe + 2층 whitewash). [seed.json `massing`]
- 기단 행은 기본 없음 — 벽이 땅에 바로 닿는다. [seed.json `ground`]
- 처마는 끝 조각 바깥 2~3px, 벽 끝 조각은 inset 2. [seed.json `eave`]

---

## 5. 하지 말 것

1. **어떤 게임의 실제 픽셀·타일시트·스크린샷을 복제하지 않는다.** 이 문서의 표는 「무엇이 등장하는가」의 근거일 뿐, 그림의 출처가 아니다. FF/DQ/Octopath/Stardew/포켓몬 시트를 참조 이미지로 넣지 않는다.
2. **상용 RPG Maker 팩(FSM·Winlu 등)의 그림을 참조·복제하지 않는다.** 팩 존재와 구성만 근거로 쓴다. [LICENSE 확인 필요]
3. **「돔 하나 = 사막」 공식을 반복하지 않는다.** 돔은 사원 1채에만. 마을의 사막성은 **평지붕 난간·그늘 골목·안뜰·들보 끝**이 만든다.
4. **평지붕 상자만 늘어놓지 않는다.** 최소 3가지 질량 유형(1층 집 / 2층 계단집 / 안뜰집)과 1가지 수직 랜드마크(바람탑·미나렛)를 섞는다.
5. **색으로만 변형을 만들지 않는다.** 색 변형은 매싱 변형과 짝지어야 한다.
6. **바닥에 보도블록·기단 띠를 깔지 않는다.** 프로젝트 규칙(2026-10-22 사용자 반려) 위반.
7. **「사막 마을」로 잘못 분류된 장소를 인용하지 않는다** — South Figaro(항구), Porre(일반 도시), Karnak(성벽 도시). §1 정정 참조.
8. **출처 없는 수치를 만들지 않는다.** 층수·비율은 프로젝트 seed.json 규칙을 따르고, 실제 건축 수치는 위 인용 문서 범위 안에서만 말한다.

---

## 6. 남은 불확실성

- **스크린샷 직접 검증 없음.** 이 조사에서 spriters-resource·VGMaps·Stardew 위키 본문은 Cloudflare/503으로 접근이 막혔다. 따라서 표의 「지붕 형태·색」 중 상당수는 [추정]이며, 굽기 전에 실제 화면과 대조해야 한다.
- **Sea of Stars·Eastward·Breath of Fire·Tales of Phantasia·Romancing SaGa**는 사막 마을을 뒷받침하는 문서를 찾지 못해 표에서 제외했다. 필요하면 별도 조사.
- **DQ III Isis**는 dragonquest.fandom에 독립 문서가 없어(리다이렉트 실패) 인용하지 않았다.
- 포켓몬 Cascarrafa는 Bulbapedia가 차단되어 Serebii 지도 페이지만 근거로 썼다 — 「사막권 도시·분수 광장·물 체육관」 이상은 주장하지 않는다.
