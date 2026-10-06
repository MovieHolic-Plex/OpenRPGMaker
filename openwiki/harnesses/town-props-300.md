# 마을 기물 300종 — 명세·제작·선택·공용 배포

2026-10-05 사용자 주문: 현대 기물과 중세 RPG·크로노 트리거·FF6의 마을을 생각해 **300종 추가**.
정본 입력은 `harness-data/interior-props/town-300.txt`, 실행기는 `src/harnesses/interior-props/town_batch.py`다.
300종은 **서로 다른 용도/형태**이며 색만 바꾼 파생은 세지 않는다. 기존 약 975개와 id·slug·한글 이름 충돌을 검사했고,
기존 의자·책장·통 등의 단순 중복을 피하도록 목록을 읽고 기능별로 골랐다.

## 구성과 참고 범위

| 분류 | 수 | 마을에서 드러내려는 생활 |
|---|---:|---|
| 현대 | 90 | 거리·식료품·카페·보건·공공시설·정비·문화·주거·물류 |
| 중세 RPG | 90 | 목공·가죽·식품 가공·시장·항구·농가·서기·수도원·경비 |
| 시간여행 판타지 | 60 | 축제·발명·변경·미래 피난처·고대 마법 도시·선사 교역 |
| 증기마도 판타지 | 60 | 공업·설산 광산·항구/철도·오페라 뒷무대·도시 야간·생활 마도기술 |

시대 분위기는 [Chrono Trigger 공식 세계 소개](https://www.jp.square-enix.com/chronotrigger/jp/world.html)와
[Final Fantasy VI 공식 소개](https://na.finalfantasy.com/titles/finalfantasy6)를 참고했다.
각 게임에 아래 물건이 실제로 등장한다는 목록은 아니다. 축제/시간여행과 증기/광산/극장이라는 배경에서
마을 생활을 구체화한 **새 기물 설계 제안**이다. 원작 도트/캐릭터/상표를 복사하지 않는다.

## 실행과 재개

```bash
export PROP_HARNESS_CONTENT_ROOT=/home/main/z-project/rpg-zzu-interior-v34b
python3 src/harnesses/interior-props/town_batch.py validate
python3 src/harnesses/interior-props/town_batch.py queue
python3 src/harnesses/interior-props/town_batch.py status
```

- `validate`: 300개·90/90/60/60·중복·기존 목록·크기·윗면·대형 blockout·참고 id 검사. 쓰기 없음.
- `register`: 기존 `new/items.json`을 DATA/batch-backups에 해시로 백업하고 누락된 정의만 원자 추가.
  같은 id의 정의가 다르면 중단한다. 크기 수정은 기존 resize 경로로 한다.
- `queue`: 등록 후 각 종류 **후보 2개**, 총 **600개 후보 / 300판**. 시대별 교차 주문으로 한 시대만 오래 기다리지 않게 한다.
  note의 `[town-300-20261005]`를 키로 이미 주문된 판을 재사용한다. 중단된 brief만 다시 준비한다.
  중복 실행은 DATA 아래 배치 lock으로 거부한다. 검수 실패를 합격으로 바꾸거나 자동 선택하지 않는다.
- `status`: 이 배치에 해당하는 판/후보/brief/상태 수와 판 id·manifest SHA-256을 출력한다.
- 실제 제작은 기존 풀(기본 동시 32, 기존 모델 설정)이며 register/queue 종료는 그림 완성이 아니다.
- 인간 선택 전에는 공용 그림으로 배포하지 않는다. 선택 후 자동 게시 경로를 그대로 탄다.
- 등록 작업과 다른 새 정의 쓰기를 동시에 실행하지 않는다. 원자 교체 직전 원본 변경도 검사한다.
- 작업 서비스: `prop-town300-20261005.service`, 로그 `~/.local/share/oprn/prop-harness/town-300.log`.
  이 서비스는 명세/판 준비만 하고 끝난다. 제작 풀은 별도 서비스이며 화면을 닫아도 계속된다.

## 429 전송 실패 재시도

이번 주문 초기 32개 작업이 API 429로 후보 파일 없이 종료됐다. 제작 풀 관리자만 교체하고
실행 중 자식 32개를 모두 보존해 이어받았다. **신규 시작 상한은 일시적으로 8**이다.
기존 작업은 자연 종료하므로 교체 직후 running 수가 8보다 큰 것은 정상이다.
`prop-harness-pool-town300.service`가 제작을, `prop-town300-retry.service`의 `watch`가 전송 실패 복구를 맡는다.

`watch`는 이 배치의 terminal failed 또는 검수 ERROR만 보며, 로그 꼬리에 명시적인
`429 Too Many Requests`가 있을 때만 같은 run을 재큐한다. 지연은 60/120/240/480/900초,
run당 최대 5회이며 횟수와 시각은 `transport-429-retry` history에 남긴다.
그림 시도 번호·사용자 선택·미술 판정은 바꾸지 않는다. PASS/FAIL을 전송 실패로 덮지 않는다.
모든 작업이 종료되면 복구 서비스도 종료한다. 5회 소진/다른 실패는 status와 해당 로그를 보고 원인을 고친다.
다시 켜려면 같은 content root와 `PROP_HARNESS_PAR=8`로 `town_batch.py watch`를 실행한다.
화면의 queued/running은 완료 수가 아니다. 최신 상태 스냅숏은 `verify-shots/props-town-300/production.json`.

## 그림 계약

16px 칸, 투명 배경, 남쪽 위 3/4 시점. 층·통행은 kind/footprint/canvas에서 만든다.
깊이 2칸은 윗면 최소 12행을 주문하며 6칸 이상은 explicit blockout을 갖는다.
읽을 수 있는 글자·사람·로고를 넣지 않는다. 300개 각 행에 고유 실루엣과 장치의 재질/구성이 있다.
이미지 생성기를 직접 호출하거나 절차적 도형으로 그림을 대체하지 않는다. 기존 하네스가 pxgrid 후보를 저작·검수한다.

## 공용 DB와 조수의 사용

공용 정본은 같은 호스트의 `~/.local/share/oprn/shared-content.sqlite`, 라이브러리 `oprn-hand-interior-harness`다.
팩 `shared_hand_interior_harness`는 `projectDefaults:true`여서 새 프로젝트와 기존 프로젝트 재로드에 설치된다.
열어 둔 편집기에는 공용 자료 새로고침/프로젝트 재열기가 필요할 수 있다. 다른 호스트에 자동 복제하지 않는다.

게시기는 실제 applied/resized/variant 보고서에 있는 킷에만 `사용자 선택`, `슈퍼하네싱` 태그를 붙인다.
팩에 함께 포함된 기본 가구를 사용자 선택이라고 표기하지 않는다.
`list_spatial_designs`는 이름/id 직접 일치를 우선하고, 동일 적합도에서는 사용자 선택을 먼저 돌려준다.
Pi 시스템 지침은 시대·장소·기능에 맞는 사용자 선택 기물을 우선 검색·사용하도록 한다.
실내 골조는 기존 `build_hand_interior_room`, 공용 새 기물은 이후 `stamp_object`로 놓는다.
고정 실내 사전에 공용 킷 id를 넘기지 않으며 기본 가구와 중복 배치하지 않는다.
이 연결은 매 턴의 모델이 무조건 모든 기물을 쓴다는 보장이 아니다. 실제 검색/배치 가능성과 우선 사용 지침을 제공한다.

## 목록 (발밑 칸 × 캔버스 높이)


### 현대 거리

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 무인 택배 보관함 | `parcel locker` | 2×1 | 48px |
| 자전거 수리 거치대 | `bicycle repair post` | 1×1 | 32px |
| 주차 요금 정산기 | `parking pay station` | 1×1 | 32px |
| 제설 모래 보관함 | `road salt bin` | 2×1 | 32px |
| 사슬 연결 볼라드 | `street bollard chain` | 2×1 | 32px |
| 옥외 소방 호스함 | `hydrant hose cabinet` | 1×1 | 32px |
| 지붕 달린 버스 정류장 | `bus shelter bench` | 3×2 | 64px |
| 공공 물병 급수대 | `public bottle fountain` | 1×1 | 32px |
| 신호 제어함 | `traffic signal control box` | 1×1 | 32px |
| 분실 우산 수거 카트 | `lost umbrella cart` | 2×1 | 32px |

### 현대 식료품점

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 채소 분무 진열대 | `produce mist rack` | 2×1 | 32px |
| 곡물 정량 판매통 | `bulk cereal dispenser` | 2×1 | 32px |
| 빈 병 회수기 | `bottle return kiosk` | 1×1 | 32px |
| 식빵 절단기 | `bakery bread slicer` | 2×1 | 32px |
| 델리 번호표 기둥 | `deli ticket dispenser` | 1×1 | 32px |
| 장바구니 적재대 | `shopping basket stacker` | 1×1 | 32px |
| 식품 진공 포장기 | `vacuum food sealer` | 2×1 | 32px |
| 절임 올리브 판매대 | `olive brine counter` | 2×1 | 32px |
| 생수 리필 판매기 | `water refill vending` | 1×1 | 32px |
| 계산대 봉투 회전대 | `grocery bag carousel` | 1×1 | 32px |

### 현대 카페·식당

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 커피 원두 로스터 | `coffee bean roaster` | 2×2 | 48px |
| 디저트 돔 트롤리 | `pastry cloche trolley` | 2×1 | 32px |
| 식판 반납대 | `restaurant tray return` | 2×1 | 32px |
| 면 삶는 조리기 | `ramen noodle boiler` | 2×1 | 32px |
| 회전 닭구이 오븐 | `rotisserie chicken oven` | 2×1 | 48px |
| 밀크티 쉐이커 | `bubble tea shaker` | 1×1 | 32px |
| 초밥 회전 레일 코너 | `sushi conveyor corner` | 2×2 | 48px |
| 피자 토핑 냉장 작업대 | `pizza prep fridge` | 2×1 | 32px |
| 식기 건조 트롤리 | `dish drying trolley` | 2×1 | 32px |
| 커피 찌꺼기 수거대 | `cafe knock box stand` | 1×1 | 32px |

### 현대 보건·안전

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 치과 진료 체어 | `dental chair unit` | 2×2 | 48px |
| 시력 검안 렌즈대 | `optometry lens stand` | 1×1 | 32px |
| 혈압 측정 의자대 | `blood pressure kiosk` | 2×1 | 32px |
| 검체 원심 분리기 | `medical centrifuge` | 1×1 | 32px |
| 의료 소독 압력기 | `sterilizer autoclave` | 1×1 | 32px |
| 재활 평행봉 | `rehab parallel bars` | 2×2 | 32px |
| 산소통 운반대 | `oxygen cylinder trolley` | 1×1 | 48px |
| 응급 제세동기 카트 | `ambulance defibrillator` | 1×1 | 32px |
| 약 계수 작업대 | `pharmacy pill counter` | 2×1 | 32px |
| 비상 세안대 | `emergency eyewash` | 1×1 | 32px |

### 현대 공공시설

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 도서 자동 반납함 | `library book return` | 2×1 | 32px |
| 도서관 마이크로필름 판독기 | `library microfilm reader` | 2×1 | 32px |
| 박물관 음성 안내기 충전대 | `museum audio guide rack` | 1×1 | 32px |
| 투표 기표 부스 | `voting privacy booth` | 1×1 | 48px |
| 민원 순번 발급기 | `municipal queue kiosk` | 1×1 | 32px |
| 역 수하물 계량대 | `station luggage scale` | 2×1 | 32px |
| 대합실 온수 급탕기 | `station drinking urn` | 1×1 | 32px |
| 공공 구두 광택기 | `coin shoe polisher` | 1×1 | 32px |
| 기부 의류 수거함 | `community donation cage` | 1×1 | 48px |
| 민원 직인 날인대 | `municipal stamp desk` | 2×1 | 32px |

### 현대 정비 공방

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 탁상 드릴 프레스 | `bench drill press` | 1×1 | 48px |
| 자동차 휠 밸런서 | `wheel balancing machine` | 2×1 | 32px |
| 유압 자동차 잭 | `hydraulic floor jack` | 2×1 | 16px |
| 자동차 진단 카트 | `car diagnostic trolley` | 1×1 | 32px |
| 용접 차광막 틀 | `welding curtain frame` | 2×1 | 48px |
| 도료 혼합기 | `paint mixing shaker` | 1×1 | 32px |
| 고압 세척 호스릴 | `pressure washer reel` | 1×1 | 32px |
| 부품 초음파 세척조 | `parts ultrasonic bath` | 2×1 | 32px |
| 공구 배터리 충전 카트 | `battery charging cart` | 1×1 | 32px |
| 압축 공기 건조기 | `compressed air dryer` | 1×1 | 32px |

### 현대 취미·문화

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 도예 유약 분사 부스 | `pottery glaze booth` | 2×1 | 48px |
| 실크스크린 인쇄대 | `screen printing rack` | 2×2 | 48px |
| 암실 사진 확대기 | `darkroom enlarger` | 1×1 | 48px |
| 레코드 청음 부스 | `record listening booth` | 2×1 | 48px |
| 클라이밍 착지 패드 | `climbing crash pads` | 2×2 | 32px |
| 양궁 과녁 운반대 | `archery target trolley` | 2×1 | 48px |
| 탁구 공 발사기 | `table tennis robot` | 1×1 | 32px |
| 필름 편집 콘솔 | `film editing console` | 2×1 | 32px |
| 기타 이펙터 케이스 | `music pedalboard case` | 2×1 | 16px |
| 의류 스팀 다리미대 | `sewing dress steamer` | 1×1 | 48px |

### 현대 생활 세부

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 로봇 청소기 도크 | `robot vacuum dock` | 1×1 | 16px |
| 가정용 음식물 처리기 | `home compost machine` | 1×1 | 32px |
| 접이식 빨래 건조탑 | `folding drying tower` | 2×1 | 48px |
| 고양이 운동 바퀴 | `cat exercise wheel` | 2×1 | 48px |
| 아기 기저귀 교환대 | `baby changing station` | 2×1 | 32px |
| 수조 여과 장치장 | `aquarium filter cabinet` | 1×1 | 32px |
| 베란다 식물 조명대 | `balcony grow light rack` | 2×1 | 48px |
| 전기 전골 이동상 | `induction hotpot cart` | 2×1 | 32px |
| 주택 누수 점검 장비 | `water leak detector kit` | 1×1 | 16px |
| 신발 건조 살균함 | `shoe drying cabinet` | 1×1 | 32px |

### 현대 물류·서비스

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 화물 랩 회전 포장기 | `pallet wrapping turntable` | 2×2 | 48px |
| 소포 분류 롤러 분기 | `roller sorting junction` | 2×2 | 32px |
| 수동 팔레트 운반기 | `hand pallet jack` | 2×2 | 32px |
| 배달 보냉 박스 | `refrigerated delivery box` | 1×1 | 32px |
| 세탁소 옷 회전 레일 | `laundry garment conveyor` | 2×1 | 48px |
| 열쇠 복제 절삭기 | `key cutting machine` | 1×1 | 32px |
| 구두 밑창 압착기 | `shoe sole press` | 1×1 | 32px |
| 꽃집 포장 작업대 | `florist wrapping bench` | 2×1 | 32px |
| 현금 운송 보안 케이지 | `cash transport cage` | 1×1 | 48px |
| 휴대전화 수리 작업대 | `mobile phone repair mat` | 2×1 | 32px |

### 중세 통·목공

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 통 널판 굽힘 화덕 | `barrel stave bending fire` | 2×2 | 32px |
| 통장이 깎기 목마 | `cooper shaving horse` | 2×1 | 32px |
| 통 테 굽힘 거치대 | `wooden hoop rack` | 2×1 | 32px |
| 통나무 톱질 받침 | `log saw trestle` | 2×1 | 32px |
| 대패밥 수거 광주리 | `wood curl hamper` | 1×1 | 32px |
| 나무 못 건조판 | `peg drying board` | 2×1 | 32px |
| 수레바퀴 살 조립틀 | `wheelwright spoke jig` | 2×2 | 32px |
| 아교 데우는 이중 솥 | `wood glue warming pot` | 1×1 | 32px |
| 목수 먹줄 작업대 | `carpenter marking beam` | 2×1 | 32px |
| 나무 지붕널 묶음대 | `roof shingle bundle stand` | 2×1 | 32px |

### 중세 가죽·직물

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 가죽 긁는 경사 받침 | `hide scraping beam` | 2×1 | 32px |
| 가죽 불림 돌통 | `leather soaking pit` | 2×2 | 32px |
| 구두 골 나무걸이 | `cobbler last tree` | 1×1 | 48px |
| 안장 꿰매기 집게 | `saddle stitching clamp` | 1×1 | 32px |
| 양털 빗질 작업대 | `wool carding bench` | 2×1 | 32px |
| 아마 줄기 꺾는 틀 | `flax breaking frame` | 2×1 | 32px |
| 아마포 표백 펼침틀 | `linen bleaching frame` | 2×2 | 32px |
| 좁은 리본 베틀 | `ribbon weaving loom` | 1×1 | 32px |
| 염료 안료 갈판 | `dye pigment grinding slab` | 2×1 | 32px |
| 펠트 모자 성형대 | `felt hat blocking stand` | 2×1 | 32px |

### 중세 식품 공방

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 맥아 건조 체대 | `malt drying sieve` | 2×1 | 32px |
| 홉 건조 사다리 | `hops drying ladder` | 1×1 | 48px |
| 맥주 발효 큰 통 | `ale fermenting vat` | 2×2 | 48px |
| 치즈 유청 배수대 | `cheese draining rack` | 2×1 | 32px |
| 생선 훈연장 | `fish smoking cabinet` | 2×1 | 48px |
| 소시지 충전 작업대 | `sausage filling bench` | 2×1 | 32px |
| 꿀 침전 통 | `honey settling vat` | 1×1 | 32px |
| 소금 원뿔 성형대 | `salt cone molds` | 2×1 | 32px |
| 식초 발효 단지대 | `vinegar mother crock` | 1×1 | 32px |
| 허브 시럽 달임대 | `herbal cordial still` | 2×1 | 32px |

### 중세 시장·측량

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 곡물 부셸 계량대 | `grain bushel measure` | 2×1 | 32px |
| 포목 길이 재는 대 | `cloth measuring rail` | 2×1 | 32px |
| 시장 대형 막대저울 | `market balance beam` | 2×1 | 48px |
| 통행세 동전 분류대 | `toll coin sorting tray` | 1×1 | 32px |
| 행상 견본 서랍함 | `merchant sample chest` | 2×1 | 32px |
| 장터 햇빛 가리개 받침 | `market umbrella stone` | 2×1 | 48px |
| 등짐 바구니 한 쌍 | `empty woven panniers` | 2×1 | 32px |
| 깨진 항아리 수리대 | `pot repair stapling bench` | 2×1 | 32px |
| 행상 칼갈이 수레 | `travelling knife grinder` | 2×1 | 32px |
| 장터 접이 판매함 | `market closing chest` | 2×1 | 32px |

### 중세 항구·어업

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 그물 수선 틀 | `net mending frame` | 2×1 | 48px |
| 버들 통발 적재대 | `lobster creel stack` | 2×1 | 32px |
| 노 받침 수리대 | `oarlock repair bench` | 2×1 | 32px |
| 밧줄 꼬기 회전대 | `ropewalk twisting stand` | 2×1 | 32px |
| 돛천 수선 틀 | `sail patching frame` | 2×2 | 32px |
| 배 틈막이 역청 화로 | `pitch caulking furnace` | 1×1 | 32px |
| 부두 권양 브레이크 | `harbor capstan brake` | 2×1 | 32px |
| 부두 짐걸이 삼발대 | `quayside cargo sling` | 2×2 | 48px |
| 진주 선별 작업대 | `pearl sorting shells` | 2×1 | 32px |
| 선원 장화 건조틀 | `sailors drying boots` | 1×1 | 32px |

### 중세 농가·마을

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 낫날 두드림 받침 | `scythe peening anvil` | 1×1 | 32px |
| 도리깨 걸침대 | `threshing flail stand` | 2×1 | 32px |
| 곡식 키질 받침 | `winnowing basket stand` | 1×1 | 32px |
| 뿌리채소 저장고 덮개 | `root cellar hatch` | 2×2 | 32px |
| 과수 접목 작업대 | `orchard grafting bench` | 2×1 | 32px |
| 짚 벌집 차양대 | `beehive skep shelter` | 2×1 | 48px |
| 우물 두레박 지렛대 | `well bucket balancing arm` | 2×2 | 48px |
| 전서구 귀환장 | `pigeon message loft` | 2×1 | 48px |
| 마을 빨래 두드림돌 | `village laundry beating stone` | 2×1 | 32px |
| 마을 진흙 장화 털이 | `communal boot scraper` | 1×1 | 16px |

### 중세 길드·서기

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 봉랍 인장 작업대 | `wax seal warming desk` | 2×1 | 32px |
| 양피지 펼침틀 | `parchment stretching frame` | 2×1 | 48px |
| 서기 잉크 말림대 | `scribe sand shaker stand` | 1×1 | 32px |
| 길드 견습 도구함 | `guild apprenticeship chest` | 2×1 | 32px |
| 마을 헌장 열람함 | `town charter display` | 2×1 | 32px |
| 도량형 원기 보관장 | `weighing standard cupboard` | 1×1 | 48px |
| 전령 문서 관 꽂이 | `messenger dispatch tubes` | 1×1 | 32px |
| 세금 셈막대 기록대 | `tax tally cutting desk` | 2×1 | 32px |
| 측량 평판대 | `surveyors plane table` | 1×1 | 32px |
| 길드 투표 항아리 | `guild voting urn` | 1×1 | 32px |

### 중세 수도원·구호

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 순례 지팡이 보관대 | `pilgrim staff rack` | 1×1 | 48px |
| 구호 빵 배식함 | `alms bread hatch` | 2×1 | 32px |
| 수도원 약찜 화로 | `herbal infirmary brazier` | 1×1 | 32px |
| 성물 운반 가마대 | `reliquary carrying poles` | 2×1 | 32px |
| 성화 채색 서안 | `illuminator pigment desk` | 2×1 | 32px |
| 수도원 식사 알림판 | `monastic silence bell` | 1×1 | 32px |
| 장례 운구대 | `funeral bier stand` | 2×2 | 32px |
| 봉헌 배 모형대 | `votive ship model` | 2×1 | 32px |
| 순례자 발 씻는 통 | `pilgrim footbath trough` | 2×1 | 32px |
| 구호 의복 분류대 | `charity garment shelves` | 2×1 | 32px |

### 중세 경비·마구

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 쇠뇌 장전 작업대 | `crossbow spanning bench` | 2×1 | 32px |
| 화살 깃 붙임 틀 | `arrow fletching jig` | 2×1 | 32px |
| 사슬갑옷 고리 작업대 | `mail riveting stump` | 1×1 | 32px |
| 방패 채색 거치대 | `shield painting easel` | 1×1 | 48px |
| 마구 가죽 세척대 | `saddle soap station` | 2×1 | 32px |
| 말 빗질 도구함 | `horse grooming box` | 1×1 | 32px |
| 파수꾼 경보 딱따기 | `watch alarm rattle` | 1×1 | 32px |
| 성문 짐 검사 거울대 | `gate inspection mirror` | 1×1 | 48px |
| 기사 창기 꿰맴대 | `lance pennant sewing stand` | 2×1 | 32px |
| 행군 지도통 보관대 | `campaign map cylinder rack` | 2×1 | 32px |

### 시간여행풍 축제

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 축제 고리 던지기대 | `festival ring toss stall` | 2×1 | 32px |
| 축제 힘겨루기 종탑 | `festival strength bell` | 1×1 | 64px |
| 축제 탄산 음료 펌프 | `festival soda barrel pump` | 1×1 | 32px |
| 축제 엿 늘임대 | `festival candy pulling hook` | 1×1 | 32px |
| 축제 풍선 추 묶음 | `festival balloon weights` | 1×1 | 48px |
| 축제 태엽 경주판 | `festival automaton race` | 2×2 | 32px |
| 축제 경품 토큰 교환대 | `festival prize token booth` | 2×1 | 32px |
| 축제 그림자극 상자 | `festival shadow puppet screen` | 2×1 | 48px |
| 축제 행운 회전판 | `festival fortune wheel` | 2×1 | 48px |
| 축제 소풍 도시락 꾸러미 | `festival picnic hamper` | 2×1 | 16px |

### 시간여행풍 발명 공방

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 태엽 장치 납땜대 | `clockwork solder station` | 2×1 | 32px |
| 진자 시간 측정틀 | `pendulum timing rig` | 2×1 | 48px |
| 태엽 스프링 감개 | `spring winding machine` | 1×1 | 32px |
| 유리 진공 종 실험대 | `glass vacuum bell` | 1×1 | 32px |
| 자석 부양 실험대 | `magnetic levitation rig` | 2×1 | 32px |
| 기계 날개 시험틀 | `clockwork wing model` | 2×1 | 48px |
| 전신 계전 연습대 | `telegraph relay practice` | 2×1 | 32px |
| 자이로 균형 실험대 | `gyroscope balancing stand` | 1×1 | 32px |
| 실험 코일 보호망 | `power coil safety cage` | 1×1 | 48px |
| 발명 도해 회전대 | `prototype instruction lectern` | 1×1 | 32px |

### 시간여행풍 변경 마을

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 피난민 공동 취사 삼발대 | `refugee cooking tripod` | 2×2 | 48px |
| 야전 전령 새 바구니 | `field courier pigeon basket` | 1×1 | 32px |
| 목교 수리 도르래대 | `bridge repair winch` | 2×1 | 48px |
| 변경 경보 징대 | `frontier warning gong` | 2×1 | 48px |
| 행군 건빵 건조대 | `ration biscuit drying` | 2×1 | 32px |
| 변경 들것 보관틀 | `battlefield stretcher rack` | 2×1 | 32px |
| 변경 배급 기록대 | `frontier ration ledger` | 1×1 | 32px |
| 폐탑 시계판 전시대 | `ruined clock dial stand` | 2×1 | 48px |
| 나룻배 삯 보관함 | `river ferry fare box` | 1×1 | 32px |
| 변경 추모 리본대 | `memorial ribbon pole` | 1×1 | 48px |

### 시간여행풍 미래 거주지

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 영양 식량 배급기 | `nutrient ration dispenser` | 1×1 | 48px |
| 씨앗 저온 보관 서랍 | `seed cryo drawer` | 2×1 | 32px |
| 재활용 태양열 조리대 | `salvaged solar cooker` | 2×2 | 32px |
| 공기 수분 응축탑 | `water condenser tower` | 1×1 | 48px |
| 피난처 축전지 교환대 | `shelter battery exchange` | 2×1 | 32px |
| 로봇 수리 팔다리 걸이 | `robot spare limb rack` | 2×1 | 48px |
| 공동 공기 정화장치 | `communal air filter` | 2×1 | 48px |
| 폐전선 피복 벗김대 | `salvage wire stripping bench` | 2×1 | 32px |
| 기억 카트리지 보관함 | `memory cartridge archive` | 1×1 | 48px |
| 피난처 수동 발전 라디오 | `shelter hand crank radio` | 1×1 | 32px |

### 시간여행풍 고대 마법 도시

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 부유 향연 수반 | `levitating incense basin` | 1×1 | 32px |
| 수정 관개 조절기 | `crystal irrigation valve` | 1×1 | 32px |
| 꿈 기록 현악 장치 | `dream recording harp` | 2×1 | 48px |
| 별빛 응축 단지 | `starlight distillation urn` | 1×1 | 48px |
| 구름 정원 바람종 | `cloud garden wind chime` | 1×1 | 48px |
| 부유 서책 고정대 | `floating book cradle` | 1×1 | 32px |
| 마력 실 방적대 | `mana thread spinning rig` | 2×1 | 32px |
| 성좌 항해 수반 | `astral navigation basin` | 2×2 | 32px |
| 부유 장치 균형추 | `levitation ballast blocks` | 2×1 | 32px |
| 태양 프리즘 받침 | `sun prism window stand` | 1×1 | 48px |

### 시간여행풍 선사 교역

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 흑요석 떼기 작업대 | `obsidian knapping mat` | 2×1 | 16px |
| 뼈 구슬 꿰기 틀 | `bone bead threading rack` | 1×1 | 32px |
| 갈대 생선 건조돔 | `reed fish drying dome` | 2×2 | 48px |
| 선사 발효 진흙 통 | `clay fermentation jars` | 2×1 | 32px |
| 조개 화폐 선별판 | `shell currency sorting` | 1×1 | 16px |
| 나무 장난감 썰매 | `stone age toy sled` | 2×1 | 16px |
| 화산 증기 찜 바구니 | `volcanic steam basket` | 1×1 | 32px |
| 상아 공구 걸침대 | `mammoth tusk tool rest` | 2×1 | 32px |
| 선사 빗물 받이 | `primitive rain catcher` | 2×2 | 48px |
| 부족 이야기 돌판 | `tribal story pebble board` | 2×1 | 16px |

### 증기마도풍 공업 마을

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 증기 호루라기 배관대 | `steam whistle manifold` | 2×1 | 48px |
| 공장 금형 보관대 | `factory punch die rack` | 2×1 | 32px |
| 보일러 압력계 교정대 | `boiler gauge calibration` | 2×1 | 32px |
| 리벳 압착 프레스 | `riveting press pedestal` | 1×1 | 48px |
| 증기관 보온재 적재대 | `steam pipe insulation rolls` | 2×1 | 32px |
| 기어 윤활유 침전대 | `gear oil settling tray` | 2×1 | 32px |
| 공장 교대 나팔대 | `factory shift horn` | 1×1 | 48px |
| 연탄 압축 성형기 | `coal briquette press` | 2×1 | 48px |
| 공장 작업복 세척통 | `industrial safety wash` | 2×1 | 32px |
| 공압 문서관 수신기 | `pneumatic message terminal` | 1×1 | 48px |

### 증기마도풍 설산 광산

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 광부 안전등 충전대 | `miners lamp charging rack` | 2×1 | 32px |
| 광석 품위 감정대 | `ore assaying crucibles` | 2×1 | 32px |
| 광산 구조 호흡기대 | `mine rescue breathing set` | 1×1 | 48px |
| 광부 장화 눈 녹임판 | `snow melt boot grating` | 2×1 | 16px |
| 광맥 시추 표본장 | `ore sample core cabinet` | 2×1 | 32px |
| 갱도 승강기 신호대 | `mine cage signal post` | 1×1 | 48px |
| 광산 새장 보온상자 | `canary transport warmer` | 1×1 | 32px |
| 빙결 드릴 연마대 | `frozen drill sharpening` | 2×1 | 32px |
| 광부 도시락 보온대 | `miners lunch heating shelf` | 2×1 | 32px |
| 갱도 강삭 이음대 | `pithead cable splice stand` | 2×1 | 32px |

### 증기마도풍 항구·철도

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 철도 통표 교환대 | `railway token exchange` | 1×1 | 48px |
| 역 유등 정비대 | `station oil lamp service` | 2×1 | 32px |
| 철도 분기 모형 제어대 | `rail switch model desk` | 2×1 | 32px |
| 철도 짐 막대저울 | `baggage weighing beam` | 2×1 | 48px |
| 항구 무적 압축기 | `harbor foghorn compressor` | 2×1 | 48px |
| 비공정 계류 집게 | `airship mooring clamp` | 2×1 | 32px |
| 비공정 기낭 수선대 | `airship canvas gasbag patch` | 2×1 | 32px |
| 항만 세관 봉인 프레스 | `cargo customs seal press` | 1×1 | 32px |
| 기관사 운행 도식대 | `engineer route slate` | 1×1 | 32px |
| 부두 공압 작은 기중기 | `dockside pneumatic hoist` | 2×2 | 48px |

### 증기마도풍 오페라 뒷무대

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 오페라 천둥 철판틀 | `opera thunder sheet` | 2×1 | 48px |
| 무대 바람 효과통 | `stage wind machine` | 2×1 | 32px |
| 무대 빗소리 회전통 | `stage rain pebble drum` | 2×1 | 32px |
| 오페라 드레스 골조대 | `opera costume bustle rack` | 2×1 | 48px |
| 무대 가발 손질대 | `wig dressing head shelf` | 2×1 | 32px |
| 공연 소품 검 보관함 | `prop sword foam chest` | 2×1 | 32px |
| 오페라 대사 지시함 | `prompter hood box` | 2×1 | 32px |
| 무대 승강문 감개 | `stage trapdoor winch` | 2×1 | 32px |
| 무대 배경 채색 발판 | `scenery paint bridge` | 2×1 | 32px |
| 오케스트라 악기 보관장 | `orchestra instrument locker` | 2×1 | 48px |

### 증기마도풍 도시 야간

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 카지노 칩 세척대 | `casino chip wash tray` | 2×1 | 32px |
| 수동 카드 섞기 장치 | `card shuffling crank` | 1×1 | 32px |
| 호텔 객실 호출 벨판 | `hotel pneumatic bell board` | 2×1 | 48px |
| 옥상 빨래 도르래대 | `rooftop laundry pulley` | 2×1 | 48px |
| 골목 석탄 투입함 | `alley coal hatch` | 1×1 | 32px |
| 거리 군밤 화로수레 | `street chestnut brazier` | 2×1 | 32px |
| 가스등 점검 수레 | `gas streetlamp service cart` | 2×1 | 48px |
| 전당포 감정 작업대 | `pawn appraisal loupe bench` | 2×1 | 32px |
| 하숙집 세숫대 보관장 | `boarding house wash lockers` | 2×1 | 32px |
| 옥상 빗물 저장조 | `rooftop rain cistern` | 2×2 | 48px |

### 증기마도풍 생활 마도기술

| 기물 | id | 발밑 | 그림 높이 |
|---|---|---|---:|
| 마도 의수 조정대 | `magitek prosthetic fitting` | 2×1 | 32px |
| 마도 가로등 충전대 | `crystal streetlight charger` | 1×1 | 48px |
| 마도 정수 여과기 | `magitek water purifier` | 2×1 | 48px |
| 가정용 열수정 난로 | `domestic heat crystal stove` | 1×1 | 32px |
| 마도 청음 증폭기 | `magitek hearing horn` | 1×1 | 32px |
| 마도 전차 승차권 천공기 | `crystal tram ticket punch` | 1×1 | 32px |
| 마도 보조다리 충전대 | `magitek prosthetic charging` | 1×1 | 48px |
| 시골 결계 정비함 | `rural ward maintenance kit` | 2×1 | 32px |
| 추억 영사등 수리대 | `memory lantern repair` | 2×1 | 32px |
| 가정용 마력 계량기 | `magitek household meter` | 1×1 | 32px |
