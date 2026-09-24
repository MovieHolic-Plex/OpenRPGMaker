# Pixel Art World ZIP XP 판본67 · 사용자 로컬 가져오기

`autotiles-archive.json`은 별도 SHA 감사에서 남은 **정적96×128 PNG 67고유SHA**의 범위다.
실제6원본 접촉시트를 확인하고 기존140 원본과 decoded 픽셀을 비교했다. 65개는 새 그림,
2개는 기존 그림과 동일한 PNG 바이트 판본이다. 기존140 JSON·ID·47변형 순서·8atlas는 변경하지 않는다.
범위 밖 VX/MV/혼합규격과 현재 지도페이지의 다른 SHA를 이 숫자에 섞지 않는다. 이67개에는 권리
표시로 가져오기를 보류한 항목이 없다. 사이트 전체 지원 완료를 뜻하지 않는다.

## 출처·권리·구판 바탕의 한계

2026-09-25 직접 확인한 제작자 페이지:
[옥외](https://yms.main.jp/dotartworld/page3/autotiles01.html),
[실내](https://yms.main.jp/dotartworld/page3/autotiles02.html),
[지도 축척](https://yms.main.jp/dotartworld/page3/autotiles03.html),
[이용 규약](https://yms.main.jp/dotartworld/page1/rule.html).
옥외 페이지는2012년 개편 때 그림자 알파 처리·수정·지면색·파일명 정리가 있었다고 설명한다.
현재PNG와 ZIP 안의 같은 파일명이 같은 그림을 뜻하지 않는다. `archiveSources`에 공식ZIP URL,
ZIP SHA256, 정확한 member 경로와 PNG SHA를 연결했다. ZIP들은 PNG와 디렉터리만 포함한다.
해당 오토타일 영역에는 RPG Maker 전용 표시가 없으며 일반 이용조건을 기록했다.
공개 게임에는 Pixel Art World / ドット絵世界 크레딧, 원본·수정素材 재배포 금지. 모든 픽셀은
사용자 로컬에서 읽고 합성하며 Git/public/배포 번들에는 넣지 않는다.

불투명 Mapbase의 회색/점무늬 바탕을 자연스러운 완성 월드맵으로 과장하지 않는다. 이는 **원본
판본의 재료 조립**이다. 현재 공식 MapbaseF01 직접PNG도 ZIP의
`c1c832a25c4b0d5aa172af863ee83018a607f71500f8e79f0ef2d059ae8c661c`와 동일하다.
P-mode PNG의 tRNS index0 표시는 있으나 index0 사용픽셀이0이므로 실제 alpha는 모두255다.
[RPG Maker XP 공식 설명](https://www.rpgmakerweb.com/products/rpg-maker-xp)은 투명색 지정 기능을
확인해 준다. 그러나 제작자 지도페이지와 [사용법](https://yms.main.jp/page-s1/howto_wolf.html)에서
이 파일군의 특정 회색을 반드시 지우거나 바탕을 교체하라는 지시는 확인하지 못했다.
기능 존재와 개별 소재의 요구를 구별하며 색키/픽셀 삭제를 추측해서 적용하지 않는다.
투명 산·숲·수면만 실제 MapbaseF04 모래 평지로 받친다. 불투명한 원본 배경은 보존한다.
지도용 소재는 거리의 나무/바위/실물 호수와 축척이 다르다.

## 형식·중복·정책

새65 family의 ID는 `paw-xp-archive-*`이다. 기존 full-edge XP 쿼터 합성/정렬 계약을 재사용한다.
모든 원본은정적1프레임이며 animationStrips를 추가하지 않는다. `terrainTag:0`은 중립이다.
자동 lower37종, 수동 upper blob23종, 직사각형 lower3종/upper2종으로 구분했다.
수동 upper를 자동 연결하는 엔진 기능을 새로 주장하지 않는다.

- 울타리/화단/산/숲/물/담쟁이/호박 작물은 기본 차단이다.
- 일반 바닥·포장·잔디·러그·발판·이끼·밭 지면은 기본 통행 허용이다. 게임 충돌은 저자가 조정한다.
- Saku는 제작자가 명시한 옥상 난간이며 직사각형만 승인한다. Sunoko는 온전한 널빤지 발판의
  직사각형 표본이다. 화단2종과 파란 시트도 이번 표본에서 직사각형으로 제한한다.
- Pumkin01/02/03은 실물에 열매가 없는 짚 지면이다. Pumkin04만 잎·줄기·호박이 있다.
- 투명 식생/러그/돌길은 지면, 담쟁이는 벽, 난간은 지붕 받침을 지정한다.
  불투명 원본은 미리 그려진 외곽 배경까지 보존한다.

두 byte alias는 새 family/47칸을 중복 생성하지 않는다:

| ZIP PNG SHA 시작 | 기존 family | 판본 이름 |
|---|---|---|
| b3391e95c4e2 | paw-groundg01 | SA-GroundG01.png |
| c810e1a36f668 | paw-floor-t08 | SA-Floor-T01.png / SA-Floor-T09.png |

`resolvePixelArtWorldAutotileEdition`은 고정된 alternate SHA와 기존 canonical SHA 관계만 허용한다.
실제 가져온 판본 SHA/ZIP 출처로 MD를 생성하되 family ID는 유지한다. 같은 family가 이미 있으면
다른 판본으로도 중복 추가할 수 없다. 브라우저에서 두 판본의 전체 파생PNG 동일과 중복 거절을
관찰했다. 이름으로 일반적인 파일을 동등하다고 인정하지 않는다.

## 사용자 다운로드와 AI 자료

카드는 직접PNG와 ZIP판본을 구별한다. 사용자가 공식ZIP을 내려받아 표시된 member PNG를
추출한 뒤 선택한다. 앱이 ZIP/PNG를 자동으로 다운로드하거나 임의 색키 처리를 하지 않는다.
SHA/치수/대상 lineage·저장 대상·baseasset을 확인하고 기존 atlas 끝에 추가한다. 예약shared_
타일셋에 직접 추가하지 않는다. UI 실제관측은 ZIP Saku→32px 사용자 atlas376→424칸,
상위 수동, MD3/그림3, 오류0이며 private 메모리 세션이다. 정본 저장 증거가 아니다.

새 pack의 `referenceExample`은 작은 표본 width/height, 전체 footprintRows, 받침 key와 용도를
담는다. importer는 실제47마스크로 전체 lower/upper 배열을 만들고 source/variants/normal-error
그림과 MD3개를 표준 owned referenceDocuments에 넣는다. 기존140은 이 필드가 없어 기존
16×10 진단 배열을 유지한다. 기본 UI 가져오기의 첫 불투명 lower 받침은 여전히 진단용이며
적합한 장소라고 보증하지 않는다. 별도 library 준비는 명시한 실제 받침을 사용한다.

## 별도 공용 library 준비

새 library 권장 ID는 `pixel-art-world-xp-archive-local`이다. 기존8atlas를 다시 생성하지 않는다.

| atlas suffix | 새 family | 최종 tile 수 | 용도 수 |
|---|---:|---:|---:|
| vegetation |22|1088|24(받침+byte alias 자료 포함)|
| world |19|944|20|
| surfaces |13|656|14|
| fields |11|560|12|

각 atlas는16열·앞32칸 받침/정렬로 시작하며 family마다47변형+1행정렬칸을 붙인다.
안정 ID는 `shared_paw_xp_archive_<suffix>`와 `_image` 자산이다. 4tilesets/4assets/65structureKits,
장소/지역/맵0개다. 작은 표본65개는 기본5×4, Saku만6×5이고, 실제 그림·전체 배열·오류 좌표를
kit 자체에도 소유한다. 큰 면은 마스크를 다시 계산하며 표본을 도장 반복해 경계를 만들지 않는다.

byte alias 자료는 첫atlas의 별도용도에 기존canonical owner의 전체 사전/배열을 대상 ID 그대로
인용한다. 이 배열을 새ZIP atlas의 번호로 오인하지 않도록 대상 ID를 명시한다. 기존owner는
`shared_paw_xp_ground`와 `shared_paw_xp_interior_floors`다.

```bash
node scripts/content/prepare-pixel-art-world-archive-autotiles.mjs
node scripts/content/prepare-pixel-art-world-archive-xp-library.mjs http://127.0.0.1:9878 /사용자/다운로드 output/호스트/current-portable.json output/호스트/source-proof.json output/paw-xp-archive/prepared
python3 scripts/content/render-pixel-art-world-archive-xp-review.py output/paw-xp-archive/prepared output/paw-xp-archive/review-final
```

첫 명령은 픽셀 없는 typed catalog를 생성한다. 둘째는 실제 importer, 전체 quarter 픽셀 대조,
타일/kit/참고그림 연결 스키마, alias 일치/중복 거절을 수행하고 **private JSON만** 쓴다.
호스트 portable과 영수증 SHA를 요구하며 ZIP/PNG SHA, ZIP member→PNG 관계와 실제치수를 재확인한다. 참고그림은
lossless WebP로 줄이고 decoded RGBA가 동일한지 검사하며 실제 게임 PNG 자산은 그대로다.
원본→atlas 비교는 같은 브라우저로 정규화한 alpha/비투명RGB 3,128,320픽셀이지, 원본 rawRGBA
일치라는 주장이 아니다. 참조그림 압축은 이미 정규화된 입력의 decoded RGBA 동등성이다.

2026-09-25 private 결과: library9,087,026바이트, 고유참조272그림 base64합계5,219,226→879,052바이트.
6원본+6조립접촉판과 고위험 모양, 정상/오류, UI 그림을 직접 검토했다. 공용 게시·정본 CAS 저장·
재로드는 root의 후속 단계다. DB 쓰기/전체테스트/게이트는 이 준비 스크립트 범위 밖이다.
