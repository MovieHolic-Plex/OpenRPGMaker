# 저택 외관 B/P/Y — 전체 건물과 작은 정원

사용자 원본픽셀은 Git/public에 넣지 않는다. 3원본의 검토 raw54객체와 로컬합성7개,
3개의 작은 장소를 지원한다. 원본408칸 전체 학습/자동 보행발코니 구현을 의미하지 않는다.

| 팩 | 원본/규격 | SHA256 |
|---|---|---|
| paw-mansion-exterior-b | ST-MsionB-E01.png /256×1632/native32/8×51 | 1a48151aa07d6b2c7d59b7a8674bf143060841d25ad2d5dd20bc4e5d214d246b |
| paw-mansion-exterior-p | ST-MsionP-E01.png /동일규격 | 3723b044833d5a95680298df805d7b6ae321f6be89d6ddf375c2f5c8122d8775 |
| paw-mansion-exterior-y | ST-MsionY-E01.png /동일규격 | 4769c99df2461d753265d01b3a526e25ec06e88b6df351856c201bb715f94b80 |

## 판본과 읽은 실제 근거

[공식 외관 페이지](https://yms.main.jp/dotartworld/page2/tile-mansion01.html)는 세 색의 내용이 같다고
설명하지만, 이번 지원은 파일명만으로 같다고 가정하지 않았다. 실제 408셀의 RGBA/alpha를 비교했다.
B 대비 P198/Y194셀의 RGBA가 다르고 **alpha차이는 모두0**이다. 투명RGB 차이도 포함하므로
변경셀 숫자를 보이는 색차이의 개수로 해석하지 않는다. 각 whole-object의 rawRGBA SHA와
B대비 일치 여부는 mansion-exteriors-comparison.json 및 생성된 read-first MD에 있다.
원본 PNG SHA와 rawRGBA hash는 다른 값이다. 각 색은 자기 사용자 원본에서 직접 조립한다.

공식 실제 샘플은 세 색 저택 `smp-msionB02/05/06.JPG`, 정원 `smp-MsionB01.JPG`,
보행 발코니 `smp-msionB04.JPG`, 차정원 `smp-msionB03.JPG`를 직접 열었다.
경로는 https://yms.main.jp/dotartworld/sozai/tileset/smp_fantasy01/ 이다.
현재 정본 revision49의 paw-urban-residential 타일 문서/실제 그림 및 도시 출입 배열을 읽었다.

## 완전체 원본과 구조 받침

raw recipe.sourceRect는 0기준 **32px 칸**, tiles는 행우선 `tile=y*8+x`다.
각색18raw: 전체곡면지붕, 전체외벽bay, 아치창+현관전면, 아치창3종, 발코니 난간앞뒤/토대,
벤치앞/뒤, 가로등, 원형티탁자, 원형스툴, 장미2종, 꽃화분받침, 정원수2종, 닫힌철제문.

- 지붕 `(0,28)5×5`: 상단과 양쪽곡면/마감/전면처마 전체다. 원본중앙 x2열만 반복가능,
  양쪽곡면을 늘이거나 중간행만 사각 지붕으로 복제하지 않는다. 단독 지상가구가 아니다.
- 외벽 `(0,33)5×3`: 상단cornice, 기둥, 벽몸통, 석축기단/양끝까지. 높이는34행몸통만 반복한다.
- 전면 `(5,36)3×5`: 2층 아치창과 그 아래 석재턱, 1층 현관 기둥·문틀·기단 전체.
  검은 현관 그림은 자동개폐/잠금/전이가 아니다. 문앞 지상바닥에 action 이벤트를 따로 저작할 수 있다.
- 아치창 `(6,23)1×2`, `(7,23)1×3`, `(5,26)3×3`은 wall-mounted, 벽면을 받침으로 둔다.
- 발코니 난간 `(0,41)3×4`: 북쪽뒷난간/양옆/남쪽앞난간/전면토대 전체.
  가운데 투명부는 바닥이 아니라 뒤 받침이 비치는 영역이다. 다른난간변형과 섞어 복층 통행을 만들지 않는다.
- 벤치 정면 `(0,13)2×2`, 뒷면 `(0,15)2×2`는 별도원본. 차정원 남쪽벤치는 북향뒷면이다.
- **스툴 `(6,11)1×1`은 등받이가 없고 원형좌판/받침**이다. 동향/서향 등받이의자를 추정해 만들지 않는다.
  P차탁 양옆에 같은 원본을 무회전·무반전으로 두며 남쪽/옆칸 접근을 유지한다.

roof/wall/building-part의 단독 정상/오류 그림은 whole 조각비교다. 바닥에 홀로 놓아도
정상인 가구라고 오해하지 않도록, 관련 raw/object 문서에 실제 전체건물 받침 도해를 함께 붙인다.

## 원본408칸 보존 후 합성7개

composites.parts.sourceRect/offset은 **픽셀**, 컴파일된 composite.sourceRect/tiles는 **파생 atlas 칸**이다.
원본408칸 뒤에만 추가한다. B/Y528칸, P552칸이다. PNG파일SHA는 원본/파생 각각 다르다.

### 색별 전체 건물3개

전체7×10. 원본지붕5열 `[0,1,2,3,4]`를 `[0,1,2,2,2,3,4]`로 조립하고
외벽은33행→34행3줄→35행기단 순서다. 중앙 원본전면3×5를 `(2,5)`에,
작은아치창2개를 `(1,6)/(5,6)`에 겹친다. 단일 상위에 다시 창을 찍어 벽을 지우지 않는다.
지붕/처마/벽/기단/현관의 전체 원본픽셀을 합성하고 정적 upper+solid 객체로 제공한다.
전체 source-over 부품목록이 JSON과 AI문서에 있다. 지상문앞 `(3,10)`이 접근점이다.

P표본은 건물 x0이 캔버스 가장자리에 있지만 클리핑하지 않는다. 원본 각 지붕열32×160과
파생7열 전체를 비교해 **모든 RGBA/alpha 차이0**임을 확인했다. 마감픽셀을 위해 표본을 넓히지 않았다.

### 색별 순수 장식포르티코3개

원본 `(5,31)3×5`를 그대로 rawwhole로 잡으면 중앙윗칸에 위쪽 아치창하단이 섞인다.
이 잘린 이웃창을 배포하지 않는다. 아래 whole 부품을 리사이즈 없이 source-over한다.

1. 왼쪽 `(160,992,32,160)` → `(0,0)`.
2. 중앙난간·아래 `(192,1024,32,128)` → `(32,32)`.
3. 오른쪽 `(224,992,32,160)` → `(64,0)`.

결과96×160은 기둥발과 양끝머리/앞난간 전체다. 창을 지우는 색칠·임의 알파처리·잘린 기둥 없음.
**장식발코니는 보행층이 아니다.** 공식 보행발코니는 건물1→창2→발코니3층이 필요하다.
이번 정적 whole 객체에는 캐릭터 올리기/난간뒤 걷기/계단교차를 지원했다고 표시하지 않는다.
완성건물 표본에는 이 장식포르티코를 넣지 않아 기둥앞/뒤 접근 충돌을 숨기지 않는다.

### P 원형탁자와 찻잔2개

전체원형탁자 `(128,288,64,96)` 위에 전체찻잔 `(192,320,32,32)`을 `(6,25)/(30,25)`에 합성한다.
소품 최하단2픽셀행은 base의 불투명 상판 y24..62 안이어야 한다. 실제 importer가 검사한다.
두 잔/탁자 밑동 전체를 보존하며 별도 상위 소품을 찍어 탁자를 삭제하지 않는다.

## 작은 실제 장소3개

| 표본 | 크기 | 배치와 접근 |
|---|---|---|
| B 현관·벤치 | 9×13 | 건물1,0; 남쪽4,12→현관4,10, 벤치앞2,12/꽃화분앞8,10 |
| P 옆 차정원 | 11×12 | 건물0,0; 현관3,10, 우측탁자8,5/스툴7,6와10,6; 북향벤치앞9,8 |
| Y 정원수 관리로 | 11×13 | 건물3,0; 현관6,10, 서쪽정원수옆x2한칸길, 남동벤치앞9,12 |

세 색 전체건물은 검증된 같은 구조계열이고 주변사용관계는 다르게 설계했다.
그림을 다른 구조라고 과장하지 않는다. 보도는1~2칸의 짧은접근과 가구전면을 연결한다.
상위객체투명여백을 통로로 계산하지 않으며 지붕/벽은 전체solid다.
standing 밑동은 실제하위지면, wall-mounted는 벽받침, building-part는 완성건물 관계를 따른다.
장소 전체 lower/upper·placements·rooms·doorways·approachCells와 실제 PNG를 place자료로 인계한다.

## 준비·공용 배포 계약

```bash
node scripts/content/prepare-pixel-art-world-mansion-exteriors.mjs
node scripts/content/prepare-pixel-art-world-mansion-exterior-browser.mjs http://127.0.0.1:PORT src/assets/pixelArtWorldMansionExteriorsCatalog.json /absolute/user-png-directory output/paw-mansion-exteriors/prepared
node scripts/content/prepare-pixel-art-world-native-install.mjs src/assets/pixelArtWorldMansionExteriorsCatalog.json output/paw-mansion-exteriors/prepared output/paw-mansion-exteriors/install
```

Catalog raw54와 Layout final61/scenes3를 구분한다. 객체문서는 prepared.structureKits,
장소는 scene-<id> 카테고리의 owned MD/이미지와 정확한배열을 사용한다.
공용등록/정본저장·재로드는 root감독자가 수행한다. prepare는 DB쓰기가 없고 저장증거가 아니다.
외부타일셋 UI의 metadata카탈로그에 등록하며 사용자가원본을가져올때만실제픽셀/자료를생성한다.

## 확인한 범위

실제원본3장/공식6샘플/전체raw54객체/합성7개와3장소를 직접 보았다.
부모가 커밋전3장소를 열고 진행가능 판정; 후속 P지붕마감/원형스툴 방향을 픽셀·문서로 확인했다.
최초 raw포르티코의 창조각혼입은 제거하고 정적whole합성으로 수정했다.
실제browser importer: 원본408칸RGBA보존, sourceSHA/shape, 바닥·상판접지, 하위불투명, scene배열동일성.
actual collision.canMove17접근점 양방향: B33칸/84방향간선, P28/70, Y53/128.
이것은 엔진데이터 경로관찰이며 플레이어 이벤트/실내전이/보행발코니 QA가 아니다.
DB쓰기·gates·vitest·typecheck는 실행하지 않았다.
