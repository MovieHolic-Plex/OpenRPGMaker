# 조사 04 — 도트 게임·픽셀 작품의 일본 동네 표현

> 2026-10-06 웹 조사 원문(출처 URL 포함). 「추정」·「확인 못 함」 표시는 조사자가 남긴 것이다. 요약·적용은 [README.md](README.md).

- **조사 범위**
  - 손 도트 정면 3/4 시점에서 현대·쇼와 일본 거리를 그린 게임은 생각보다 적었다.
  - 많이 인용되는 작품 가운데 MOTHER2·OMORI는 미국을 모델로 했다. 보쿠나츠(ぼくのなつやすみ)는 3D다. 東方·魔界塔士 SaGa·Hylics에서는 일본 동네 묘사를 **확인 못 함**.
  - 그래서 실제 근거는 포켓몬 금은, 真・女神転生 SFC, LIVE A LIVE, RPG 메이커 일본 소재, 픽셀 아티스트 작품에서 나왔다.

**1. 작품별**

- **포켓몬 금은 (코가네시티 = 오사카)**
  - 개발 원본 맵 이름이 `OSAKA`, 블록셋 파일이 `OSAKACEL.CEL`이다. 코가네는 조토 공용 블록셋을 쓰지 않고 전용 타일을 쓴다. [TCRF](https://tcrf.net/Pok%C3%A9mon_Gold_and_Silver/Unused_Maps)
  - 모티프: 통천각 같은 전망탑(라디오탑), 지하상가, 신칸센 역(자석열차). [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Goldenrod_City)
  - 크기 단위:
    - 걸음 1칸 = 16px = 플레이어 크기, 화면은 10×9칸. [pokecrystal wiki](https://github.com/pret/pokecrystal/wiki/Add-a-new-tileset)
    - 도시 맵은 20×18블록(블록 = 32px) = 40×36칸 ≈ 화면 4×4장. 와카바 마을은 10×9블록, 고목 마을은 20×9블록. [map_constants.asm](https://raw.githubusercontent.com/pret/pokecrystal/master/constants/map_constants.asm)
    - 큰 도시도 화면 16장 남짓으로 압축한 셈이다.
  - 일본 요소는 소품이 아니라 **시설 종류**로 전한다(백화점 옥상, 지하상가, 역). 전봇대·노렌은 생략했다.
  - 엔주시티(교토)는 탑과 무희 극장으로 전통을 맡는다.

- **포켓몬 BW (참고만)**
  - 카메라를 3D로 당겨 큰 도시감을 낸다. 플레이어는 "시점이 줄 하나 기준으로 바뀌어 어지럽다"고 지적했다. [PokéCommunity](https://www.pokecommunity.com/threads/opinions-on-the-camera-angles.242796/)
  - 고정 3/4 시점인 우리에게는 해당이 없다.

- **MOTHER2 (비교용)**
  - 건물은 사투영(oblique), 포사이드만 아이소메트릭이다. [Starmen.net](https://forum.starmen.net/forum/Games/Mother3/Oblique-Projection)
  - 걷는 스프라이트는 16×24px, 타일보다 위로 반 칸 높다. [SNESMaps](https://www.snesmaps.com/maps/EarthBound/sprites/EarthBoundSprites.html)
  - 미국풍이라 일본 표지는 없다. 다만 "캐릭터가 타일보다 키가 크다"는 규약은 우리에게도 쓸모 있다.

- **真・女神転生 SFC (기치조지)**
  - 실제 지리를 2D 필드 지도로 축약했다. 선로는 분홍 선, 역은 사각형이고, 아케이드 상가 아래에 역이 있다. [note 분석](https://note.com/hhrr_eeuu/n/n4ca3ed66a347)
  - 아케이드 상가의 드러그스토어 위치가 실제 가게 자리와 맞는다. [note 속편](https://note.com/hhrr_eeuu/n/ne5caa8fa06e2)
  - 한 줄로 정리하면 "동네 = 거점 몇 개를 잇는 작은 지도"다.

- **LIVE A LIVE 근미래편 (2010 도쿄, 쇼와 감성)**
  - 마을 하나에 갈 곳 7개: 공원, 아이들 보호소(ちびっこハウス), 寿商会(상점), 항구, 연구소, 바(바 MATANGO), 절. [nJOY](https://i-njoy.net/lal_fd1.html)
  - 리메이크에서 도로 차선을 일본식(**좌측통행**)으로 고쳤다. [pixiv百科](https://dic.pixiv.net/a/%E8%BF%91%E6%9C%AA%E6%9D%A5%E7%B7%A8)

- **ゆめにっき**
  - 무한 도로, 라바콘, 신호등(신호등 이펙트), 차량 사고 모티프가 있다. [yume.wiki](https://yume.wiki/yume/Road)
  - 건널목이 있는 일본 거리 맵은 **확인 못 함**.

- **The Friends of Ringo Ishikawa**
  - 1980년대 일본 시골 마을이 무대다. 옆에서 보는 측면 시점이라 우리 시점과는 다르다.
  - 골목 안 비디오 가게, 강변, NPC 일과, 패미컴 대용품 같은 생활 소재가 핵심이다. [Wikipedia](https://en.wikipedia.org/wiki/The_Friends_of_Ringo_Ishikawa) · [TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/TheFriendsOfRingoIshikawa)

- **Eastward**
  - 홍콩·상하이와 함께 쇼와·다이쇼 시대 일본 마을을 섞었다. "익숙한데 낯설게"가 목표다. [Game Developer](https://www.gamedeveloper.com/business/road-to-the-igf-pixpil-s-i-eastward-i-)
  - 타일 크기는 **확인 못 함**. 기본 해상도 약 640×360은 사용자 추정이다. [Steam 토론](https://steamcommunity.com/app/977880/discussions/0/4521040918045115545/)

- **RPG 메이커 일본 소재**
  - どらぴか 현대 거리편 (48px, 16px 아님):
    - 상가 아케이드, 고가 아래 역, 움직이는 열차, 선로 위 육교 계단이 있다.
    - 애니메이션 오브젝트: 건널목, 이발소 회전 기둥, 실외기, 신호등, 아케이드 셔터. 문은 48×64 / 48×72px.
    - 내려간 셔터, 「テナント募集」(임차인 모집)·「閉店」(폐점) 종이로 쇠락한 분위기를 낸다. [Steam](https://store.steampowered.com/app/1648411/RPGMZ/?l=japanese) · [리뷰](https://yuzuyu3.com/rpgmaker-dorapikamap/)
  - SERIALGAMES 살고 싶은 거리:
    - 상가·역 앞·공원·주택가 구성이고, **낮·저녁·밤 3종을 시트 15장**으로 따로 그렸다.
    - 빌딩용 배관·실외기·비상계단, 아스팔트 차선·횡단보도가 있다. [komodo](https://plaza.komodo.jp/products/serialgames-%E4%BD%8F%E3%81%BF%E3%81%9F%E3%81%84%E8%A1%97%E3%82%BF%E3%82%A4%E3%83%AB%E3%82%BB%E3%83%83%E3%83%88)
  - 현대 일본 도시 타일셋: 차·열차·신호등이 있고, **발광 차분 20점**과 오버레이 필터 그림 3장이 들어 있다. [komodo](https://plaza.komodo.jp/products/%E7%8F%BE%E4%BB%A3%E6%97%A5%E6%9C%AC%E9%83%BD%E5%B8%82%E3%82%BF%E3%82%A4%E3%83%AB%E3%82%BB%E3%83%83%E3%83%88)
  - ドット絵世界 「레트로 거리」: 흰 벽 거리, 쇼와 초기 목욕탕(「宝湯」), 여관, 공동 화장실 목조 아파트. 간판 글씨는 칸테이류(勘亭流) 서체다. [yms](http://yms.main.jp/dotartworld/page2/tile-retrotown01.html)
  - LimeZu Modern Exteriors (16px): 일본 교외 주택 1채만 있다. 자판기는 역 테마에 들어 있다. [devlog](https://limezu.itch.io/modernexteriors/devlog/1033339/397th-update-additional-houses-7)
  - 위 제품 설명 어디에도 「전봇대」가 적혀 있지 않다(그림에 있는지는 **확인 못 함**).

- **픽셀 아티스트**
  - waneella:
    - 구글 스트리트뷰에서 일본 거리를 보고 출발한다. [Thames & Hudson](https://www.thamesandhudsonusa.com/books/waneella-pixelscapes-hardcover)
    - 반복 태그: 전선, 간판, 한자·히라가나, 상자 더미, 라바콘, 자판기, 쓰레기통, 가로등, 배관, 네온, 횡단보도, 라멘 의자. [wallhaven](https://wallhaven.cc/w/zyqx1v) · [wallhaven2](https://wallhaven.cc/w/po9jo9)
  - 1041uuu (豊井祐太):
    - 정지 화면에서 몇 군데만 움직인다. 주로 물이 움직인다.
    - KOF96 에사카 스테이지에서 영향을 받았다. 사람보다 "장소의 냄새"를 그린다. [Neocha](https://neocha.com/magazine/japan-pixelated/) · [pixivision](https://www.pixivision.net/en/a/2686)
    - 밤 편의점 작품이 있다. [Steam 출처 링크](https://steamcommunity.com/sharedfiles/filedetails?id=861626378)
  - Kirokaze: 일본 건널목 작품은 **확인 못 함**. 열차 도시는 SF다. [DeviantArt](https://kirokaze.deviantart.com/art/Train-City-659551770)
  - たきまコウ 「帰路」: 전봇대 구조가 가장 어려웠다고 하며, 『電柱マニア』를 참고했다. [note](https://note.com/takimakou/n/n05a47fff4a25)

**2. 공통 패턴**

- 화면 구성 비율(건물 몇 %, 도로 몇 %)을 잰 자료는 **확인 못 함**.
- 사례에서 반복되는 것:
  - **일본임을 알리는 일은 소품이 한다.** 전선·자판기·간판 글자·실외기·셔터·라바콘이 그렇다. 건물 외형만으로는 약하다(waneella, どらぴか).
  - **밀도는 높이로 낸다.** Eastward: "높이 차는 밀도의 친구", "계단으로 건물 뒤를 지나가도 가려지지 않게". [Game Developer](https://www.gamedeveloper.com/art/eastward-s-creators-share-insights-on-making-pixel-art-adventures)
  - **같은 그림을 시간대별로 따로 그린다.** SERIALGAMES 낮·저녁·밤, 현대 일본 도시의 발광 차분. 밤에는 간판 불빛 차분이 핵심이다.
  - **채도:** どらぴか는 "채도가 조금 높다"는 평을 받았다. 쇼와풍은 채도를 한 단계 낮추는 편이 안전하다(이건 추정).

**3. 정면 3/4 + 16px 맵 구성 팁 (근거 + 추정)**

- **생활도로 폭**
  - 일본 법정 도로는 원칙상 폭 4m 이상이다. 2항 도로(옛길)는 1.8~2.7m에서 시작한다. [나카노구](https://www.city.tokyo-nakano.lg.jp/machizukuri/kenchiku/tetsuzuki/kenchikukijun/kenchikukijyunho42.html)
  - 주택의 약 32%가 폭 4m 미만 도로에 접해 있다(2008 통계 기준). [총무성](https://www.stat.go.jp/data/jyutaku/2008/nihon/8_1.html) · [국토교통성](https://www.mlit.go.jp/jutakukentiku/house/content/001735119.pdf)
  - 스기나미구는 도로의 약 30%가 2항 도로다. [스기나미구](https://www.city.suginami.tokyo.jp/s099/1885.html)
- **칸 수 제안 (추정, 1칸 ≈ 1~1.3m)**

  | 길 종류 | 폭 |
  |---|---|
  | 골목 | 1~2칸 |
  | 주택가 길 (보도 없음, 흰 선 갓길) | 3칸 |
  | 2차선 + 보도 | 7~8칸 |

- **블록 크기**: 금은 기준으로 화면 = 10×9칸이다. 블록 하나는 화면 반쪽(5×4~5칸) 정도로 잡으면 한 화면에 교차로가 1~2개 보인다(추정).
- **차량은 좌측통행**으로 둔다. 정류장·차선 화살표도 마찬가지다(LIVE A LIVE 리메이크의 수정 근거).
- **거점 압축**: 한 동네에 들어갈 곳은 5~7곳이면 충분하다(LIVE A LIVE 7곳, 기치조지 6번호).
- **2항 도로 동네의 표정** (일반 관찰, 출처 없음):
  - 막다른 길, 꺾이는 골목, 계단 길, 옹벽 위 집.
  - 건널목과 육교는 길을 끊어 맵에 리듬을 준다. どらぴか에서 육교 계단을 실제로 걸을 수 있다.
- **전봇대**:
  - 위 칸에 완목·애자·변압기, 아래 칸에 기둥과 그림자를 두는 2칸 상층 오브젝트로 그린다.
  - 전선은 1~2px로 처지게 긋는다. 맵 전체 덮개(오버레이)로 처리하는 방법도 있다.
  - 이 항목은 검색 요약의 일반론이라 1차 출처는 없다.

**4. "일본 동네다"를 느끼게 하는 상호작용**

- **자판기**
  - 포켓몬 표준: 물 200, 사이다 300, 레모네이드 350. 옥상의 목마른 소녀에게 음료를 주면 기술머신을 받는 퀘스트가 있다. [Bulbapedia](https://bulbapedia.bulbagarden.net/wiki/Vending_Machine)
  - 5세대에서는 자판기가 거리 곳곳에 놓인다.
- **구멍가게(駄菓子屋)**
  - 보쿠나츠 4편에는 가게 앞에 50엔 오락기(QIX)가 있다. 3D 작품이다. [Wikipedia](https://ja.wikipedia.org/wiki/%E3%81%BC%E3%81%8F%E3%81%AE%E3%81%AA%E3%81%A4%E3%82%84%E3%81%99%E3%81%BF)
  - 「昭和駄菓子屋物語」는 가게 경영 자체가 게임이다. [4Gamer](https://www.4gamer.net/games/335/G033599/)
- **건널목**: 차단기·경보 애니메이션이 있고, 열차가 지나갈 때까지 기다린다(どらぴか).
- **목욕탕(銭湯)**
  - 地獄銭湯는 접수대(番台)에서 물건 팔기와 영업 뒤 청소를 시킨다. 3D 작품이다. [전격](https://dengekionline.com/article/202410/19464)
  - 도트 쪽 실례는 소재(宝湯)뿐이다.
- **신사 참배·오미쿠지**: 도트 거리 게임에서의 상호작용 구현 사례는 **확인 못 함**. 「にほんの田舎ぐらし」의 첫 참배가 언급된 정도다. [inside-games](https://www.inside-games.jp/article/2026/03/14/178590.html)

**jp_city에 다음으로 넣을 후보 (위 근거로 정리)**

1. 전봇대 + 전선 덮개 세트: 모든 작품의 공통 1순위 표지인데 상용 소재에서도 비어 있다.
2. 자판기·라바콘·실외기·셔터·폐점 종이 소품 줄.
3. 건널목 + 선로 + 육교·계단·옹벽 같은 높이 차 키트.
4. 밤 차분(간판 발광).
5. 목욕탕·구멍가게·작은 신사처럼 상호작용 거점 3채.
