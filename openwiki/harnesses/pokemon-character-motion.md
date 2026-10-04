# Pokemon character motion harness — native contract2

몬스터 수집 장르 캐릭터의 생성 원본 → native 후보 → 구조 검사 → 재생 검수 → 관문 → 로컬 결과물. 위치는 `src/harnesses/pokemon-character-motion/`, 시드는 `harness-data/pokemon-character-motion/seed.json`. CLI만 있으며 자동 생성·그림 그리기·에디터 화면·조수 도구·정본 쓰기는 없다.

## 원본 규격과 엔진 컨테이너를 구분한다

**Emerald 일반 인물의 원본 프레임은 16×32다. 에디터의 EasyRPG24×32 칸은 출하 컨테이너이며 그림 규격이 아니다.**

| 대상 | 실제 계약 |
|---|---|
| 걷기 native | 한 칸16×32, 한 역할48×128, 3열×4행 |
| native 포즈 순서 | 행up/right/down/left; 열stepA/idle/stepB; 정지1; 재생[0,1,2,1] |
| native 잉크 | 폭<=16, 높이18~22, top10~13, feet bottom exclusive30~32 |
| native 팔레트 | 전체12포즈 합집합<=15불투명색 + 투명색 |
| 에디터 어댑터 | native16px를24px칸의 x4에 그대로 복사. 역할72×128/8인물팩288×256. 늘리지 않는다. |
| Emerald speech/전투 인물 그림 | 별도64×64 profile. field16×32와 혼동하지 않는다. |
| 범용 오프닝 클립 | 크기 명시 가능. 기본64×64·15색; 명시64×96도 가능하나 Emerald 기본이라고 부르지 않는다. |

원본 근거: [graphics definitions](https://github.com/pret/pokeemerald/blob/master/src/data/object_events/object_event_graphics.h), [graphics info](https://github.com/pret/pokeemerald/blob/master/src/data/object_events/object_event_graphics_info.h), [base OAM](https://github.com/pret/pokeemerald/blob/master/src/data/object_events/base_oam.h), [animation commands](https://github.com/pret/pokeemerald/blob/master/src/data/object_events/object_event_anims.h), [movement constants](https://github.com/pret/pokeemerald/blob/master/include/constants/event_object_movement.h). 일반 걷기 PNG는144×32의9프레임이며 동쪽은 서쪽 그림 hFlip이다. May 잉크14×20, Brendan14×21, Birch16×20이며 native 한 프레임 전체를 그림으로 채우지 않는다. 측정·source/probe SHA와 URL은 `harness-data/pokemon-character-motion/emerald-native-reference-contract.json`에 둔다. Nintendo 원본 PNG는 검토용 외부 폴더에만 두며 Git·공용 출하에 넣지 않는다.

`VERSION=pokemon-motion-2`. 옛24×32 source provenance/검수는 읽기·build에서 거부한다. raw source로 새 import해야 한다.

## 실행과 저장 경계

16역할: hero/rival/professor/nurse/merchant/mother/resident/gym_leader/company_agent/captain/worker/explorer/student/ranger/moon_leader/hiker.

`POKEMON_MOTION_SANDBOX` 또는 `--sandbox /absolute/path`로 격리한다. 기본은 harness-data/pokemon-character-motion. 후보는 candidates/<id>/이며 source.png/prompt.txt/native charset.png/provenance.json을 보존한다. 큰 생성 원본은 공유 검토 디렉터리에 두고 최종 그림·출처 해시·판정·관문만 커밋한다. 감독자가 공용 등록 및 실제 프로젝트 저장·재로드를 수행한다.

```bash
npm run harness -- pokemon-character-motion status --sandbox /path/review
npm run harness -- pokemon-character-motion import --sandbox /path/review \
  --role hero --source /path/hero.png --prompt-file /path/prompt.txt --sampling raster
# --sampling grid --block7: 기존 공통 격자 importer; source의 포즈별 경계 재맞춤에 주의한다.
npm run harness -- pokemon-character-motion import --sandbox /path/review \
  --role hero --source /path/native48x128.png --prompt-file /path/origin.txt --native
# --native source72x128 또는288x256 --slot0..7은 중앙16밖 잉크를 거부한다. 버리고 크롭하지 않는다.
npm run harness -- pokemon-character-motion check --candidate /path/candidates/hero-...
npm run harness -- pokemon-character-motion preview --candidate /path/candidates/hero-...
# 원본1배/3배를 실제 재생하고 방향·발 교대·상체·소품·루프를 검수해 증거를 캡처한다.
npm run harness -- pokemon-character-motion review --candidate /path/candidates/hero-... \
  --who supervisor --why '방향·발·상체·루프 재생 검수' --verdict pass --evidence /path/walk.webm,/path/review.json
npm run harness -- pokemon-character-motion gate --candidate /path/candidates/hero-...
npm run harness -- pokemon-character-motion build --candidate /path/candidates/hero-... --out /path/output/hero
```

`check`/`gate --structural-only`는 구조만 검사하며 build 권한이 아니다. 일반 gate는 현재 그림의 감독자 재생 판정도 요구한다. 몬스터 종 그림의 별도 사람 후보 선택 규칙을 우회하지 않는다.

build 결과 **charset.png=48×128 native**, **editor-charset.png=72×128 x4padding**이다. motion.json에 native dimensions와 editorAdapter.resize=false/해시를 따로 기록한다. 루트의288×256공용 캐스트 팩은 editor-charset.png로 조립한다.

## 생성 원본 가져오기

실제 alpha와 기존 backgroundMask로 투명/단색 마젠타 배경을 구분하고3×4포즈의 여백을 읽는다. RGBhidden을 투명색으로 오해하지 않는다. 각 방향의 세 포즈가 공유하는 source-row 좌표를 보존한다.

raster mode는 **source-space 상단6native행의 최장 연속 잉크 행 중심 중앙값을 샘플링 전에** 맞춘다. head center7.5, y11, 전체12포즈 공통 scale(최대 잉크폭16/높이21), 고정 phase0.5, alpha128, 공통15색이다. idle feet bottom exclusive31에 각 direction trio를 **같이** ±1px만 이동하며 걷기 포즈의1px phase를 보존한다. 그 이동 전에 임시 높이34에서 샘플하고 최종32범위 바깥 잉크는 거부한다. 가로 바깥 샘플도 검사해 비대칭 큰 팔을 조용히 잘라버리지 않는다. 새 픽셀 그림·윤곽 재그리기·포즈별 배율·실패에 맞춘 샘플 위치 탐색은 없다.

grid mode는12원본의 추정값 중앙값/명시 --block2..40을 **공통**으로 사용한다. 한 배율로만 줄이고15색을 공유한다. 포즈별 inferred 값·공통 블록·배율·crop/provenance를 기록한다. `quantizePalette(image,max)`는 공유되는 원본색/Lab대표색 변환이며 image를 직접 갱신하고 대표RGB배열을 반환한다. 색 위치의 alpha 형상을 추가·삭제하지 않는다.

## 구조와 시각 관문

native16×32/12포즈, 이진 알파, 위의 잉크 top/height/feet/palette, 방향별 상단6행 두개골 중심 root jitter<=1(분리된 머리카락 끝은 제외), 상단9행 최장 연속 폭 중앙값, 안정적인 머리폭/높이비<=1.25·머리/몸통 중심 면적비<=1.30, stepA/B 하체 변경>=4px, 안정적 상체의 인접 변경률<=0.36을 검사한다. 원본처럼 x0/16폭 또는 bottom32에 잉크가 닿는 것은 허용한다.

안정적 상체 변경률은 **허용된1pxroot bob을 비교시에만 등록**한다. root distance>1은 등록 전에 불합격하고 comparisonRegistration.rejected를 기록한다. 허용 범위 안에서 상체의 실제 alpha/Lab 차이가 최소인 ±1 등록을 선택하며 requestedX/Y와 선택 x/y를 모두 기록한다. 중심 반올림값을 그대로 적용해 멀쩡한 상체를 어긋나게 만들지 않는다. alpha symmetric difference와 Lab>=0.12의 색 차이만 변경으로 센다. 실제 source/output 좌표나 walkingphase는 바꾸지 않는다. 머리9행과 중심±3px 몸통만 비교해 정상 팔·다리 동작을 제외한다. 전체 bbox 폭/정확한 전체RGBA 변경은 진단·경고만 남긴다. 이러한 등록 없이 실제May조차0.62~0.74로 잘못 거부됐으며, 올바른 등록 후0~0.052로 통과한다. threshold0.36을 완화한 것이 아니다.

픽셀 수치는 방향이나 교대 다리의 **의미**를 증명하지 않는다. 일관되게 up/down을 뒤집거나 팔만 움직인 그림은 수치가 통과할 수 있다. 재생 시각 판정과 who/why/evidence가 필요하다. 옷/정체성/표정/실제 걷기 품질을 자동 pass하지 않는다.

## 오프닝 generated clip

```bash
npm run harness -- pokemon-character-motion clip-import --sandbox /path/review \
  --role professor --clip-id professor-intro --source /path/atlas.png --prompt-file /path/prompt.txt \
  --columns 3 --rows 2 --frame-width 64 --frame-height 64 --fps 6
# 반환후보에 같은 check/preview/review/gate/build를 사용한다.
```

실제6개 포즈(깜빡임·말하기·설명 손·orb·초대 손)를 공통 격자/배율/팔레트로 가져온다. default64×64/15색이며 `--frame-width 64 --frame-height 96`으로 범용64×96을 명시할 수 있다. `--max-colors`/clip-spec.paletteUnionMax로1~24색을 명시할 수 있지만 Emeraldprofile기준은15색이다. field 규격과 별개다. alpha128을 유지하며 원본 손/눈/입을 그리거나 정적 그림에서 가짜 새 포즈를 만들지 않는다.

`--clip-spec JSON`에는 columns/rows/frameWidth/frameHeight/id/fps/frameOrder/durationsMs/kind/paletteUnionMax 및 원본 sourceRects를 저작할 수 있다. 명시 crop이 없으면 alpha 여백을 읽는다. 원본 crop count/bounds를 검증한다. `--frame-order 0,1,2,0,3,4,5`처럼 순서를 명시한다. 모든 원본 프레임이 포함돼야 한다. 프레임 수2~64, fps0초과60이하, 지속시간16~10000ms, 이진alpha·잘림·palette합집합·최소4px의미변경을 검사한다. 잉크상자 정규화 후 모두 같으면 kind:drawn(translation-only) 주장을 거부한다. 실제 blink/talk/gesture가 읽히는지는 재생 검수에서 판정한다.

후보 source/prompt/clip.png/clip-metadata/provenance를 보존한다. preview는1배/3배재생·다음프레임을 제공한다. 출력은 sandbox/output/clips/<id>에 clip.png/metadata/motion.json/관문/검수를 저장한다. 엔진에 자동 배선하지 않는다. 기존 import의 `--clip-source --clip-metadata`는 이미native인줄을 가져오는 별도 호환 경로다.

## 해시와 집중 실행 증거

provenance의 version/contract/source/prompt/final/clip-meta 해시, 실제구현파일 SHA/임계, preview/review/evidence 해시가 현재와 같아야 gate/build한다. 변경·누락·낡은판정·실패는 exit1이다. build는 check를 다시 수행한다. 외부 저장소나SQLite를 건드리지 않는다.

```bash
node src/harnesses/pokemon-character-motion/node/verify.mjs
node src/harnesses/pokemon-character-motion/node/verify.mjs --raster
node src/harnesses/pokemon-character-motion/node/verify.mjs --references /path/external-emerald-reference
```

일반33개와raster20개의 집중 제어는 정상native, x0/bottom32, height/top/feet/palette위반, duplicate/head jump/scale/shuffle/seam, 작은 hair-tip 반올림값과 실제 픽셀 등록 차이·2px root 거부, exacteditorpadding·legacyoutsideink·alpha128/127·hiddenRGB·magenta·비대칭팔·nohead·unknownsampling·oldversion·fullCLI/lifecycle·clip·파일변조를 검사한다. 작은도형fixture는 테스트용이며 출하그림/실제시각승인이 아니다. reference 제어는 외부May/Brendan/Birch/woman PNG를 직접읽어 원본native계약을 검사하고 source/probeSHA와 수치만 남긴다. 원본그림을 저장소로 복사하지 않는다. 서버·Vitest·전체tsc·전체gates를 실행하지 않는다.
