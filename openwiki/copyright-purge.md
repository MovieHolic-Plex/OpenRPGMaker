# 저작권 정리 — 직접 만든 것만 남긴다 (2026-10-07~)

> 2026-10-28 예외: REFMAP 인물을 변형한 걷기 칩 `RefmapDoll<n>` 을 다시 들였다(사용자 결정 「금지 풀고 넣기」). 원본 시트·도구는 들이지 않았고, REFMAP 조건과 크레딧은 `public/assets/ATTRIBUTION.md` 「RefmapDoll」.

사용자 결정(2026-10-07): 저작권 문제로 **직접 만든 것(코드·손 도트·하네스로 그린 것)이 아니면 완전히 삭제**한다.
숨김·차단이 아니라 파일·DB 행을 지운다. 이전 결정(2026-09-29 EasyRPG 폐기, 2026-10-06 조수 차단 #2204)은
「막기」였고 등록 장소는 오히려 계속 추천했다 — 이 정리가 그것을 대신한다.

## 남기는 칩셋 (직접 만든 것)

`beodeul_city`(버들항) · `atlas_biome_interior`(손 도트 실내 v5) · `joseon_baram` · `wizarding_world` · `jp_city` · `modern_city`.
이 칩셋 위 등록 장소 37곳(조선 15 · 마법 학교 17 · 일본 도시 4 · 현대 도시 1)만 배송한다.

## 1단계 — 장소 (완료)

- **공용 DB** (`~/.local/share/oprn/shared-content.sqlite`): 라이브러리 37개 행과 그 이력(content_history 198행)을 지우고
  VACUUM 했다(3.7GB → 1.35GB). 남은 라이브러리: `charset-actor-kept`, `oprn-hand-interior-harness`, `worldmap-*` 4개.
  지우기 전 현재 판만 `~/backups/shared-places-purge-20261007.sqlite` 에 떠 두었다 — 사용자 확인 뒤 지운다.
- **번들**: `REGION_REFERENCES` 는 빈 목록, `PLACE_REFERENCES` 는 위 네 칩셋 모듈만. 지운 것: 호수·배·숲·성채·판타지·RPG 실내·
  RPG 던전·기후 마을·필드·엘프 나무 위·다양한 숲마을·큐레이션 마을 장소 모듈과 그 스냅숏(`src/project/regionReferences/*.json`),
  미리보기·내려받기 파일(`public/assets/region-references`), 검수 장소 카탈로그(`reviewedPlaces/catalog.json` 빈 목록,
  `public/assets/reviewed-places` 전부), 강변 숲마을 장소, 공용 오브젝트 카탈로그 254개와 미리보기(`public/assets/shared-objects`),
  참고 맵에서 잘라 온 집 형태 `ref-walled-*`·`ref-castle-*`.
- 아직 남은 것(2단계에서 같이 간다): 지운 장소 미리보기 중 **타일셋 참고문서가 그림으로 쓰는 것**
  (`bundledReferenceImageManifest.json`·`forestHarmonyTileset.json`·`sharedCastleReferences.json` 등이 가리킴)과 그 칩셋 자체.

## 2단계 — 자산 (2026-10-07 완료)

사용자 판정: 아래 목록은 **남긴다**. 나머지 「버림」은 지웠다. 「물어볼 것」 23묶음 중에서는 Tibo 실내 확장(가구 357종+아틀라스)과
에메랄드 캠페인 캐스트·트레이너 그림 + `pokemon-character-motion` 하네스 산출만 지웠고, 나머지 21묶음은 남겼다.

- 남김(EasyRPG·OGA 계열이지만 사용자 결정): 공용 16표정 얼굴 76세트, OpenGameArt 효과음 258개, OpenGameArt CC0 배경음악 5곡,
  EasyRPG 효과음 96개·MIDI 30곡·FaceSet 5장·걷기 칩 17장+Object1/2, 걷기 칩 전투 시트(Actor1~4·People1~5·시전),
  비인간형 파티원 시트(Animal·Monster1~3·Vehicles), Scarloxy 팩, 포켓몬 에메랄드 원작 걷기 스프라이트 참고 사본·크롭 후보.
- 지움: EasyRPG 칩셋 전부(바깥·던전·실내·배·월드·레트로·합본 마을)와 그 파생 시트 전부 — 숲마을 `forest_harmony`(부품·그림자·
  판타지 건물·선별 소품 포함), 기후 마을 4장, 바이옴 11장+바이옴 월드맵, 배·던전 `atlas_biome_dungeon`+던전 재칠 17장, 성채(OGA)·
  성 주변·항구 조각, Slates 32px, LPC 가구, Modern Exteriors 녹턴, CC0 칩셋 스테이징, Tibo 실내 확장. EasyRPG 타이틀·시스템
  스킨·게임오버·전투 배경·무기·Cloud 그림, OGA·CraftPix 전투 배경, Kenney 효과음 377개, Galmuri·Neo둥근모 글꼴, 오프닝 연구용
  타 게임 화면 25장, 마을 미리보기, 위 칩셋으로 그린 학습 렌더(`tiledata/{atlas-biomes,atlas-dungeons,atlas-interiors,atlas-towns,
  climate-villages,elf-treetop,field-routes,forest-stone-well,rpg-*,tilesets}` 의 그림, `tiledata/city-refs`, `tiledata/castle-tiles-rpgs`,
  `tiledata/forest-villages`), `openwiki/images/slates`.
- 코드: 그 칩셋을 번들에 올리던 항목(`bundled.ts`)과 그 칩셋 전용 참고문서 번들·모듈(성채·RPG 장소/실내/던전·필드·엘프·바이옴·
  다양한 숲마을·숲 부품 확장·잔디 사선·LPC·Slates·배·던전)을 지웠다. 기본 텍스처 `tex_tiles_default` 는 같은 크기의 빈 시트
  `blank-chipset.png` 로 남긴다(옛 맵 호환). 월드맵 선택 아이콘 시트는 남기고, 앞 480칸 메타는 칸 번호 정의로만 만든다.
  `configureEmeraldMonsterCast` 는 빈 함수다(캠페인 기본 걷기 칩 유지). 교수 초상은 정지 그림.
  픽셀 글꼴 이름은 스택에 남아 사용자 컴퓨터에 깔린 경우만 쓰인다.

## 3단계 — 지운 칩셋에 묶인 코드·문서 (2026-10-07)

- 데모·쇼케이스 프로젝트: 지운 칩셋 위에 그린 것은 전부 지웠다(이슬 마을 예제, 농장·상점·Ember·녹턴·하늘계단·눈산·얼음 평원·
  시장 마을·집 쇼케이스 등). 남은 예제는 Scarloxy 데모 하나다.
- 시공기·도구: 숲마을·합본 마을의 마을·집·울타리·성 시공기, 팩 마을(Rasak·REFMAP·PAW) 도구, EasyRPG 던전·실내 세션,
  숲 레시피, 키큰 풀, Tibo 실내, 기후·바이옴 기본값을 지웠다. 조수 도구 목록·지시문에서도 그 이름을 뺐다.
- 스크립트: 지운 그림·모듈을 읽던 재생성·렌더·등록 스크립트(`scripts/content/paw-maps`·rasak·refmap·숲마을 건물·기후·
  RPG 던전/실내/장소 등), 벤치마크(`src/benchmark`, `benchmark.html`, agent-bench), `fixture:sync`.
- `tiledata/`: rasak-fantasy·rasak-modern·refmap·climate-villages·forest-harmony-buildings·forest-stone-well·
  atlas-dungeons·atlas-towns·rpg-dungeons.
- 증거: Slates·성채·숲마을·기후·마을 시공기 화면(`verify-shots/`·`.omo/evidence/`·`docs/experiments/slates-astra*`).
- 위키: Slates 8쪽, 성채 2쪽, 큰/작은 마을 생성, 마을 배치 연구, 연결 던전, REFMAP 거리, 타일 벤치마크 3쪽.
- 테스트: 지운 데모·모듈이 주제인 테스트는 지웠다. 저장·로컬 스토어·팀 서비스 테스트처럼 아무 프로젝트나 쓰던 것은
  Scarloxy 데모로 바꿨다. 남은 기능(농사 런타임 등) 중 지운 농장 데모를 고정물로 쓰던 테스트는 같이 빠졌다 —
  남는 칩셋으로 새 고정물을 만들면 다시 덮을 수 있다.

### 남은 일

- 남긴 그림의 출처 중 지운 시트에서 색·질감을 표본으로 딴 것이 있다(손 도트 실내 v5 일부 바닥·벽은 지운
  `atlas-biomes/jungle-chipset.png`, 탈것 `atlas-scenes/vehicles.png` 는 EasyRPG 배 시트). 다시 그릴지는 따로 정한다.
  그 재생성 스크립트(`scripts/content/atlas-scenes/vehicle_art.py`, `atlas-pick/worldmap_check.py`)는 입력 시트가 없어 지금은 돌지 않는다.
- 남은 증거 화면 중 지운 칩셋이 우연히 찍힌 것(편집기 UI 캡처 등)은 일일이 보지 않았다.
- 위키 본문 곳곳에 지운 기능을 가리키는 문장이 남아 있다(지운 쪽으로 가는 링크 포함). 해당 쪽을 고칠 때 같이 정리한다.

## 주의

- git 이력에는 지운 파일이 그대로 남는다. 저장소를 공개하기 전에는 이력 재작성(filter-repo)이 따로 필요하다.
- 이미 지운 칩셋으로 그린 사용자 프로젝트 맵은 그림이 빠진다(타일 번호는 남는다).

## 정정 (2026-10-22) — 버들항은 「직접 만든 것」만이 아니었다: RTP 파생은 크레딧, 나무는 다시 그렸다

2026-10-07 정리는 버들항을 「직접 만든 칩셋」으로 남겼다. 그런데 2026-10-21~22 화소 감사에서 다른 결과가 나왔다.
버들항 v6 파이프라인(`scripts/content/lib/city_v6/`)은 `assets/jungle-chipset-v6.png`를 잘라 썼다. 이 시트는 지운 숲마을 시트를 다시 칠한 사본이다.
EasyRPG RTP 는 CC BY 4.0 이다(https://github.com/EasyRPG/RTP). 저작자 표기와 변경 표시만 하면 쓰고 고칠 수 있으므로,
**RTP 파생 칸은 지우지 않고 크레딧을 단다.** 2026-10-07 의 「EasyRPG 칩셋과 그 파생 전부 삭제」는 사용자 판단이었지 라이선스 요구가 아니었다.
그 판단도 버들항·탈것·월드맵 아이콘까지는 닿지 않았다.

- RTP 파생으로 확인(상류 고정 커밋 993d88cb 의 ChipSet 과 8×8 정확 대조): `beodeul_city` 784칸(땅 칸 교체 뒤 779) · `beodeul_architecture` 94 · `beodeul_forms` 86 ·
  `beodeul_reviewed` 54 (모두 retro_Exterior: 벽돌·파랑/주황 기와·판자·포석길·광장·흙), `atlas_vehicles` 163 (Ship·Exterior·Dungeon·Interior, JasonPerry CC0),
  `worldmap_selected` 464 (World·Exterior·Dungeon·Interior). 크레딧: `public/assets/ATTRIBUTION.md`
  「EasyRPG RTP material in the Beodeul sheets and the vehicle sheet」(작가별 줄, 상류 링크, 변경 표시. 내보낸 게임의 `assets/ATTRIBUTION.md` 에 들어간다).
- 검사: `python3 scripts/content/rtp-attribution/rtp_check.py`. 상류 시트 그림은 저장하지 않고 해시 지문(`fingerprint.bin`)만 둔다.
  막는 것은 RTP 화소가 있는데 ATTRIBUTION 의 `rtp-derived-sheets` 목록에 없는 시트 하나뿐이다. 버들항·탈것 굽기 스크립트 아홉 개가 굽고 나서 부른다.
- **RTP 가 아닌 것**은 활엽수 다섯 그루와 그 수관·밑동, `beodeul_ground` 나무 칸, `beodeul_warm_trees`, `beodeul_nature` 활엽 수관 윤곽,
  jungle 땅 칸 7·129·160·302·363·365·393·394·423, 조선 `trees.py` 잎 결이다. 이것들은 숲마을의 「god-tibo-imagen 으로 사용자 참고 그림을 고친」
  식생에서 나왔고, 그 참고 그림이 기록에 없다. 감독 결정으로 **새 손 도트로 다시 그렸다**(2026-10-22, `scripts/content/beodeul-redraw/`). 시트 칸 번호는 그대로이고 저장된 맵은 새 그림을 보인다.
  묶음마다 새 Opus 적대 검수를 받았다(나무 r1~r6, 땅 r1~r2, 조선 잎 결; 마지막 나무 r6 PASS). 예제 맵 다섯 장과 조수가 지은 마을(tool-village)은 1배 전후 대조를 받았다(r1~r7, 마지막 r7 PASS). 영수증은 `harness-data/object-gate/vqa/beodeul-redraw/` 에 있다.
  옛 나무 조각의 8×8 해시 대조(그림이 아니라 해시만 비교)는 바뀐 파일과 HEAD 에서 맞던 파일 475장에서 0 이다. 지운 파일 26장은 대조하지 않았다.
  object-gate(3/4)는 키트 다섯과 숲 묶음 둘을 봤다. 3/4 판정은 7/7 이고, 화풍은 6 PASS·1 REFER(woodland-north 판정 2/4)였다. 프로필이 보정되지 않은 상태라 7장 모두 18323 허용이 필요했다.
  허용 7장은 #3157 형식의 위임 기록(`by: delegated`, 근거 `receipt-trees-r6.json`)이다.
  ATTRIBUTION 은 「Beodeul trees and forest ground: redrawn by hand」 절로 바뀌었다.
- 지운 잔여물: `public/market-harness-*`(EasyRPG 혼합 마을 사본), `public/assets/generated/forest-harmony`(숲마을 생성 소품), `city_v6/v3_final.png`, `tiledata/jp-city/forest-r3/spec-tree-x8.png`.
  사본은 `~/backups/beodeul-provenance-20261021/removed/`에 있다. git 이력은 다시 쓰지 않았다.
