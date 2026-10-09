# 일본 도시 — 오락·숙박·상업 실내 장소 9곳

tilesetId `jp_city` · 그림 `public/assets/jp-city/jp-city-chipset.png`(텍스처 `tex_jp_city`, **14465칸**, 16px 칸, 시트 1536×2416px, 한 줄 **96칸** — 번호 n 의 칸은 열 n%96, 행 n÷96(내림), 픽셀 좌표 (열×16, 행×16), 모두 0 기준). 계열 `oprn-jp` — 버들항(`oprn-atlas`)·현대 도시(`modern_city`, `oprn-modern`)·조선·숲마을·EasyRPG 칩셋의 칸 번호와 섞지 않는다.

**가져오기**: `import_region_reference({id:"<장소 id>"})` → 맵 한 장 또는 여러 장(층·영화관 — 이동 이벤트로 이미 이어져 있다). **거리 건물 문과 잇기**: `link_jp_city_interior({door:{x,y}, width, place:"<장소 id>"})` 한 번 — 첫 맵에만 잇는다.
호텔은 쉬는 곳(RPG 여관)이다 — 프런트 칸에 숙박 이벤트를 단다. 직접 지으려면 맵마다 `build_hand_interior_room({tileset:"jp_city", …})`(`jp-interior-rules` 「읽는 순서 · 실행 순서」). 방 종류: `chouba` 접수·로비, `cinema-lobby` 영화관 로비(매표·매점), `cinema-theater` 상영관, `corridor` 객실 복도, `cranezone` UFO 캐처 코너, `datsuijo` 탈의실, `double` 더블 객실, `elevatorhall` 엘리베이터 홀, `famiresdining` 패밀리 레스토랑 객석, `famireskitchen` 패밀리 레스토랑 주방, `foodcourt` 푸드코트, `front` 프런트, `gccounter` 게임 센터 카운터, `genkan` 료칸 현관, `guestroom` 다다미 객실, `gyudoncounter` 규동집 카운터석, `gyudonkitchen` 규동집 주방, `karaokecorridor` 노래방 복도, `karaokefront` 노래방 프런트, `karaokeparty` 노래방 파티룸, `karaokeroom` 노래방 방, `lobby` 호텔 로비, `mall-clothes` 옷가게(몰), `mall-concourse` 몰 통로·분수 광장, `mall-electronics` 전자 매장(몰), `mall-escalator` 에스컬레이터 홀, `mall-goods` 잡화점(몰), `mangabooth` 개인 부스 구역, `mangadrink` 드링크 바·로커, `mangaopenseat` 오픈석, `mangareception` 만화 카페 접수, `mangashelves` 만화 서가, `mangashower` 샤워실, `medalzone` 메달 코너, `pachinkohall` 파친코 홀, `prizecounter` 경품 카운터, `rotenburo` 노천탕, `single` 싱글 객실, `smokingroom` 흡연실, `videozone` 비디오 게임 코너.

| 장소 id | 이름 | 종류 | 맵(예제 문서) | 짜임 |
|---|---|---|---|---|
| `jp-city-game-center-18x14` | 일본 게임 센터(ゲームセンター) 실내 | 게임 센터 | `jp-interior-ex-game-center` | 남쪽 자동문 출입구(2칸, cv-autodoor) → 2칸 세로 통로가 북쪽 메달 코너까지 곧게 오른다. 통로 동쪽은 UFO 캐처 섬(등 맞댄 두 줄 — 북쪽 줄 am-crane 9대, 남쪽 줄 am-crane 5대 + 대형 am-crane-big 2대): 남쪽 줄 손님은 입구 앞 홀 2줄, 북쪽 줄 손님은 그 위 통로 2줄에 선다. 홀 동쪽 아래 귀퉁이는 건물 밖('#')으로 막아 평면을 ㄱ자로 줄였다. |
| `jp-city-pachinko-17x14` | 일본 파친코(パチンコ) 실내 | 파친코 | `jp-interior-ex-pachinko` | 남서쪽 자동문 출입구(2칸) → 바로 북쪽에 경품 카운터(북쪽 벽 경품 선반 am-prize-shelf·재고 상자·구슬 상자 → 직원 길 한 줄 → 유리 진열 카운터 am-counter 와 계산기 am-register 줄, 동쪽 끝 한 칸 직원 틈 → 손님 자리 2줄)와 구슬 상자 더미(am-ball-box) · 화분. |
| `jp-city-famires-18x13` | 일본 패밀리 레스토랑(ファミレス) 실내 | 패밀리 레스토랑 | `jp-interior-ex-famires` | 남서쪽 출입구(2칸) → 바로 옆 맨 아래 벽 줄에 계산대(사탕 통)·디저트 냉장 진열장, 입구 서쪽에 대기 의자. 계산대 손님 쪽(입구 쪽) 두 칸은 비운다. |
| `jp-city-gyudon-11x10` | 일본 규동집(牛丼屋) 실내 | 규동집 | `jp-interior-ex-gyudon` | 남동쪽 출입구(2칸) → 입구 동쪽 바로 옆에 식권기(fd-ticket-machine) → ㄷ자 카운터(가로 7칸 + 양 끝에서 위로 꺾인 1칸, 북쪽이 열려 주방과 이어진다). |
| `jp-city-business-hotel-1f-13x9` | 일본 비즈니스 호텔 실내(1층 로비 + 객실 층) | 비즈니스 호텔 | `jp-interior-ex-business-hotel-1f` → `jp-interior-ex-business-hotel-floor` | 1층: 남쪽 유리 자동문(2칸, cv-autodoor) → 대리석 로비. 동쪽 프런트(ht-front 3칸 가로 — 직원은 북쪽 칸막이 안쪽, 손님은 카운터 남쪽 두 줄), 카운터 줄 동쪽 끝 한 칸이 직원 틈. 카운터 위 호출 종(ht-bell)·카드 키(ht-card-key). |
| `jp-city-ryokan-23x20` | 일본 료칸 실내(현관·접수·다다미 객실·남탕/여탕 노천탕) | 료칸 | `jp-interior-ex-ryokan` | 현관(남서쪽 모서리): 2칸 미닫이 출입구(genkan-door) → 타타키 한 줄(동쪽 끝 우산꽂이로 막는다) → 신발을 벗고 올라서는 큰 단(ht-genkan-step 한 줄) → 마루 첫 줄에 슬리퍼, 곁 마루에 슬리퍼 선반(ht-slipper-rack). |
| `jp-city-karaoke-20x17` | 일본 노래방(カラオケボックス) 실내 | 노래방 | `jp-interior-ex-karaoke` | 남쪽 자동문(2칸) → 2칸 폭 입구 통로 → 로비: 북쪽에 프런트 카운터 줄(kr-front · 가운데 kr-front-register, 서쪽 끝 한 칸은 직원 길), 손님 자리 두 줄 비움, 카운터 뒤 직원 쪽 벽에 대여품 선반(kr-rental-shelf). 로비 남쪽에 대기 소파. |
| `jp-city-manga-cafe-17x14` | 일본 만화 카페(漫画喫茶·ネットカフェ) 실내 | 만화 카페 | `jp-interior-ex-manga-cafe` | 남쪽 자동문(2칸, 서쪽) → 서쪽 2칸 길 → 북서쪽 접수(kr-front 줄 · 가운데 kr-front-register, 동쪽 끝 한 칸은 직원 길, 앞 손님 자리 두 줄 비움, 카운터 뒤 직원 쪽 선반). 입구 옆에 PC 오픈석(kr-pc-desk 바로 남쪽에 북향 kr-reclining-seat). |
| `jp-city-mall-1f-24x16` | 일본 쇼핑몰 실내(1층 가게·분수 광장 + 2층 푸드코트 + 영화관) | 쇼핑몰 | `jp-interior-ex-mall-1f` → `jp-interior-ex-mall-2f` → `jp-interior-ex-cinema` | 1층(거리 문과 잇는 맵): 맨 아래 4칸 자동문(cv-autodoor 둘) → 몰 통로·분수 광장(ml-floor, 트인 바닥) → 북쪽 가게 셋. 가게는 북쪽 칸막이('#' 줄)의 2칸 틈으로 들어가고, 틈 옆 통로 쪽 첫 바닥 줄(칸막이 벽면 바로 아래)에 그 가게의 진열창(ml-shopfront-clothes·-goods·-tech, wall 3×1)을 세운다. 틈 바로 아래 세로 2칸 길(벽면 높이)은 비운다. |

## 없는 것
손님·점원 NPC(Actor1 캐릭터를 이벤트로 놓는다), 게임기·노래방 화면·영화 스크린의 내용(색 덩이·빛 번짐뿐, 글자·캐릭터 없음), 숙박·식사 이벤트.
