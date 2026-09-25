# 사용자 제공 SC-Water01/02 · 한 프레임으로 합친 물줄기

하수도 native 팩과 별도로 가져오는 범용 연출 원본2장이다. 원본과 파생 그림은 사용자 로컬에만
남기고 Git/public에는 넣지 않는다. 제작자 [하수도 사용 예](https://yms.main.jp/dotartworld/page2/tile-sewer01.html)는
작은 물줄기의4분할/길이 변경과 큰 시트의 빈 공간을 설명한다. [규약](https://yms.main.jp/dotartworld/page1/rule.html)의
공개 게임 크레딧과 소재 재배포 금지를 유지한다. 여기에 RPG Maker 전용 표시는 없다.
원본 SHA/치수/알파 경계는 `sewer-water-dependencies.json`, 가져오기 계약은 `eventprops.json`에 있다.

## 실제 프레임과 앵커

| 원본 / pack ID | 실제 사용 범위 | 사용자 로컬 atlas |
|---|---|---|
| SC-Water01.png / paw-eventprop-water01 |128×128, 가로4위상. 행0/1 배수구와 아랫입술, 행2 반복 물기둥, 행3 물보라 |128×576, 32×192 12프레임 |
| SC-Water02.png / paw-eventprop-water02 |384×640 중 위쪽96×160 4그림. 아래480px는 alpha0 |384×160, 96×160 4프레임 |

작은 물줄기는 길이3 `[0,1,3]`, 길이4 `[0,1,2,3]`, 길이6 `[0,1,2,2,2,3]`이다.
각 행은 같은 위상 열에서 가져온다. 행1을 반복하면 배수구 입술이 중간에 다시 생기므로 금지다.
길이3/4/6 프레임 번호는 각각0..3/4..7/8..11이다. 32×192 공통 프레임 위쪽에96/64/0px
투명 패딩을 더해 바닥중앙(16,192)을 유지한다. 큰 것은(48,160)이며 빈12칸을 만들지 않는다.

`frameComposites`의 `{index,width,height,phase,sourceRows,parts}`가 완성 그림을 정의한다.
`parts`는 `{sourceRect:[x,y,width,height],destination:[x,y]}` 전체 배열이다. destination은
패딩 전 완성 그림 기준이다. `frames.sourceRect`는 원본 위상의 포함 사각형이고, composite가
있으면 **이 사각형 직접 복사 대신 parts를 사용**한다. `atlasOffset`은 공통 프레임 패딩이다.
합성 사전의 일대일 프레임 대응/조각 겹침/빠짐/원본 범위와 실제 알파 경계를 importer가 검사한다.
기존48pack은 composite가 없으므로 기존 whole-sourceRect 경로를 유지한다.

각 길이는 static/loop 한 쌍이다. static은 첫 위상·명령0개, loop는 fixedGraphic의 parallel
페이지에서 명시된4개의 `setEventGraphicPattern`/`wait`를 반복한다. **120ms는 편집 예시**이며
제작자 FPS라는 근거는 없다. 여러 부분 이벤트를 동기화하지 않고, 부분을 한 그림으로 합쳐
하나의 generic uploaded sprite 이벤트로 바꾼다. 기존 loader/AI crop과 asset.meta를 쓴다.
유량/수위/수영/통행/상호작용을 자동 구현하지 않는다.

## 사용자 UI와 owned AI 자료

외부 소재의 연출 카드에서 32px 사용자 타일셋을 선택하고 확인된 Water 원본을 가져온다.
선택사항인 ST-Sewer-01.png 입력을 먼저 제공하면 같은 용도에 벽/수면 배치 자료도 생성된다.
다른 에디션·원본 크기·빈 프레임은 거절한다. importer는 현재 맵/이벤트를 자동 변경하지 않는다.

- `preparePixelArtWorldEventProp(file,pack,assetId,{supportFile?})`
- `importPixelArtWorldEventProp(file,pack,tilesetId,signal,{supportFile?})`

표준 referenceDocuments가 전체 원본/atlas, 모든 sourceParts/프레임/변형, 실제 순서 그림,
전체 lower/upper/events/pages/commands와 정상/누락 오류를 소유한다. 선택 하수도 자료는
7×(길이+3)의 완전 배열과 벽 배수구→차단수로→1행 마른길, 물보라 수면 누락 오류를 추가한다.
작은 것은 수면1칸, 큰 것은3칸을 받침으로 검사한다. `validateWaterSupportExample`의 오류는
해당 고정 표본의 좌표 검사이며 임의 맵의 수리/물리 검사가 아니다. 기존 맵이나 시설은 덮지 않는다.

ST-Sewer 원본은256×1504, SHA256
`7850f1bc6d82ac8a9947df171e733ddde6614599bd9c6d950e4774deef3b1e1e`이다.
원본번호57/65는 벽/밑면,304/312는 수면/물,0은 마른길이다. native 하수도 가져오기가 있어야
이 번호를 사용한다. 다른 Fountain/WallLion 자산을 이 원본의 대체 ID로 쓰지 않는다.

## 재생성과 비공개 준비

```bash
python3 scripts/content/prepare-pixel-art-world-water-eventprops.py /사용자/다운로드
node scripts/content/prepare-pixel-art-world-water-events.mjs http://127.0.0.1:9878 /사용자/다운로드 output/paw-water/prepared
node scripts/content/observe-pixel-art-world-water-events.mjs output/paw-water/prepared
```

첫 명령은 두 metadata JSON만 생성한다. 전체 eventprops 생성기도 같은 함수를 호출해 누락을 막는다.
두 번째는 실제 browser importer를 호출해 prepared.json(자산2+owned용도2), 전체 배열/실제PNG/MD,
별도 private runtime fixture를 생성한다. 세 번째는 editor play가 아닌 player.html에서 실제
정지/반복을 관찰한다. DB와 공유 라이브러리는 쓰지 않는다. 안정 자산 ID는
`shared_paw_eventprop_water01`, `shared_paw_eventprop_water02`다. owner에는 용도2개 공간이 필요하다.
공용 게시자는 원본치수 대신 asset.meta의 위 표 atlas치수/프레임 수를 검증해야 한다.

관찰: 작은3/4/6·큰5 모두4프레임 순환과 정지1프레임, 약1.5초에각12~13전환을 관찰했다.
실제 player PNG에 벽출구·연속 물기둥·수면 물보라·마른길·플레이어가 보인다. UI 파일 가져오기로
Water01 12프레임 자산과10MD/17그림(지지표본3종 포함)을 등록했다. 이것은 private 메모리 관찰이며
정본 저장 완료가 아니다. 원본→atlas는 같은 브라우저로 정규화한 alpha/비투명 RGB를 각각
53,248/61,440픽셀에서 비교했다. 원본 raw RGBA 완전일치라는 주장은 하지 않는다.
공용 게시/정본 저장·재로드는 감독자가 별도로 수행한다.
