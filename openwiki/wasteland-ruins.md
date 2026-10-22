# 폐허·황무지 칩셋 `wasteland_ruins` (2026-10-23, village-art)

포스트아포칼립스 마을 종류 셋을 짓기 위한 공용 번들 칩셋이다. 셋은 포스트아포칼립스 폐허 마을(정착지), 좀비 폐허 도시, 황무지 판잣집 정착촌이다.
modern 계열이고 팔레트는 modern_city 에 잠겨 있다. 그림은 코드 손 도트, 16px, 3/4 탑뷰다. 생성 이미지·글자·로고·제3자 그림은 쓰지 않는다.

## 파일

- **그리기:** `scripts/content/wasteland-ruins/`
  - `wl_core.py`: 팔레트·조각 등록·관문 이름
  - `wl_ground.py`: 흙·판석·아스팔트·웅덩이·잔해·풀
  - `wl_ruins.py`, `wl_props.py`: 건물 껍데기·담·판잣집·차·설비·소품
  - `wl_scene.py`: 비교 보드 `tiledata/wasteland-ruins/compare-3x.png`
- **굽기:** `wl_bake.py`
  - 출력: `public/assets/wasteland-ruins/wasteland-ruins-chipset.png`, `src/assets/wastelandRuinsTileset.json`, `src/assets/wastelandRuinsSheet.json`
  - 칸 번호는 `tiledata/wasteland-ruins/pins.json`에 덧붙이기만 한다. 뺀 조각의 옛 칸(dirt-a 16칸)은 빈 칸으로 남긴다.
- **관문 채택 규칙:**
  - 정식 굽기는 관문 PASS 이고 출구 허용(allow)이 있는 조각만 채택한다.
  - `--dev` 는 PASS 영수증만으로 채택하고, `--dev-refer` 는 REFER 까지 채택한다. 둘 다 검수 미리보기용이며 출하하지 않는다.
- **구성기:** `src/project/wastelandComposer.ts`, 도구 `compose_wasteland_map`(`src/editor/tools/wastelandTools.ts`).
  - 종류(kind)와 seed 만 받고, 견본을 붙이지 않고 규칙으로 한 장을 짠다.
  - 기본 크기: settlement 48×36, ruined-city 50×38, shanty 38×28.

## 조각

- **땅:**
  - dirt-b/c/d 는 8×8 칸(128px 주기) 바탕이다. b 는 젖은 움푹, c 는 자갈·녹, d 는 마른 풀이다. 64px 판은 VQA r4 에서 「되풀이가 보인다」로 반려돼 키웠다. `Board.field` 가 (x mod w, y mod h)로 깔고, 가중치는 10:3:3 이다.
  - 흩뿌리는 얼룩(잔해·웅덩이·풀)은 `blobNoise` 덩이로 모은다. 길 한가운데는 없고, 길 가장자리는 드물다.
  - slab-a/b/c: 8×8 판석. 모서리 칸만 0.7 확률로 깎는다. slab-edge·slab-break 덧칠은 10판 넘게 관문·검수에서 떨어져 뺐다(`finishSlab` 는 빈 동작).
- **아스팔트(`wl-asphalt`):** 4방향 오토타일이고 4×5 칸이다.
  - 5번째 줄은 꽉 찬 칸 속 변형 넷(긴 실금, 가로 보수, 기름 얼룩, 세로 보수)이다. `interiorVariants` 에 들어 있고, 꽉 찬 칸의 30%에 섞인다.
  - 가장자리는 선이 아니라 흙으로 뜯겨 나간 덩이다.
- **기물 킷:** `wl-<id>` 형식이다.
  - 건물 껍데기 husk-a/b/tall, 담 wall-h/v/stub
  - 판잣집 shack-a/b/c, lean-to, 컨테이너 집 container-home, 방수포 천막 tent-tarp
  - 바리케이드·울타리·고물 문
  - 녹슨 차·밴, 급수탑, 발전기, 태양판, 모닥불(3프레임)
  - 노점, 드럼통·타이어·상자, 고철·잔해 더미, 고사목·덤불·담쟁이 벽
  - 꺾인 가로등, 분리대, 빈 표지판
- **뺀 것:**
  - 관문 FAIL·REFER 이거나 검수에서 떨어진 것: fence-v, barricade-v, car-burnt, watchtower, asphalt-b/c, dirt-a
  - track(발길 오토타일): 관문·검수에서 「흙과 구분이 안 된다」로 두 번 떨어졌다. 코드는 `wl_ground.py` 에 남아 있다.

## 구성 규칙 (검수 r1~r3 에서 배운 것)

- **같은 그림 상한:** 같은 큰 조각이 줄지어 되풀이되지 않게 맵당 상한 `CAPS` 를 둔다(차 2, 잔해 더미 3, 고사목 4…). `noRepeat` 로 같은 조각이 바로 이웃하지 않게 한다.
- **쌍둥이 금지:** 넓이 4칸 이상 킷은 같은 id 가 1칸 안에 다시 찍히지 않는다(`TWIN_OK` 만 예외).
- **정착지:** seed 짝·홀로 틀이 둘이다.
  - 홀수 seed: 울 친 거주지. 남북은 철망 울타리와 고물 문, 동서는 드럼통·타이어·담 토막 기둥이다.
  - 짝수 seed: 꺾인 옛 국도를 따라 선 길가 장터다. 판잣집·노점이 양쪽에 서고, 가운데 급수탑 마당이 있고, 두 끝은 분리대 검문이다. 길 양쪽은 판석 보도, 그 바깥 7칸에 틈 둘 난 철망 울타리가 있다.
  - r2 에서 두 seed 가 같은 틀로 읽혀 나눴다.
- **좀비 폐허 도시:**
  - 가로 길 둘의 위치를 크게 흔든다. 세로 길은 둘 또는 셋이다.
  - 블록마다 쓰임이 다르다: 건물 줄, 무너진 터(판석+남은 담), 풀숲, 야영, 폐차장.
  - 담쟁이는 건물 옆구리에만 붙인다.
  - 세로 길 1~2곳을 바리케이드+분리대·드럼통 「생존자 저지선」이 막는다.
- **판잣집 촌:**
  - 옛 도로는 북쪽 또는 남쪽 끝이다. 땅을 2~3열×2행 칸으로 나누고 한 칸은 장터(판석 7×5, 급수탑, 노점, 모닥불)다.
  - 나머지 칸마다 판잣집 5~7채를 무작위로 빽빽이 모으고 울타리 토막을 둔다.
  - 흩뿌리기만 하던 판(r1)과 격자 골목 판(r3)은 「짜임이 없다」「격자다」로 반려됐다.
- **길 위 기물:** 흩뿌리는 기물은 `Board.road` 위에 서지 않는다. 차는 `wrecksOnRoad` 가 길 어깨에 둔다.

## 검수 기록

- **증거:** `tiledata/wasteland-ruins/_review/`
  - `opus-vqa-r1.json` + `vqa-r1/`
  - `vqa-r2/`, `vqa-r4/`
  - 조각 재검수 `r24`(아스팔트), `r38`(dirt-c), `r40`~`r42`(아스팔트 반려)
  - `r18/opus-reviewer-verdict.md`
  - `r20/`
- **판정 방식:** 라운드마다 새 Opus 검수자 셋이 과반으로 판정한다. 관문 REFER·FAIL 은 새 적대 검수자가 다시 보고, 통과하면 감독이 위임 허용을 남긴다. 허용 메모는 「delegated by user to supervisor 2026-10-22/23」이다.
- **보정:** 관문 프로필은 아직 미보정이다(`object-gate status`). 영수증은 그림 화소 해시에 묶여 있다.

## 마을 종류 표 연결

`src/ai/villageTypeCatalog.ts` 의 post-apocalypse · ruined-city · wasteland-settlement 는 `create_map(wasteland_ruins)` → `compose_wasteland_map` 으로 짓는다(status ready).
비교용 사이버펑크(`sf_station`)·스팀펑크(`steampunk_city`) 맵의 복사본으로 읽히지 않는지는 `scripts/qa/village-art-probe.mts` 로 나란히 렌더해 본다.
