# 목조학교 외관 / 하수도 native32

원본을 사용자가 내려받고 실제 PNG를 선택하는 기존 native importer 경로다.
Git에는 SHA·기하·전체 배열과 코드만 있다. 원본/파생 픽셀은 공용 코드나 public에 없다.
이 자료의 공용 등록 대상은 root가 관리하는 사용자 로컬 shared library이며 준비 CLI는 DB를 열지 않는다.

## 원본과 제작자 사용 예

- [목조학교 공식](https://yms.main.jp/dotartworld/page2/tile-schoolw01.html):
  `ST-Schl-WE01.png`, 256×1600, 400칸. 작은 정면 교사의 기와지붕/목조벽/창/양문과 석축 출입구.
  공식 `smp-shol25.jpg` 건물, `smp-shol24.jpg` 석축 예를 직접 확인했다.
- [하수도 공식](https://yms.main.jp/dotartworld/page2/tile-sewer01.html):
  `ST-Sewer-01.png`, 256×1504, 376칸. 마른 정비 통로, 발판과 계단, 투명 아치, 수중 단면.
  공식 `smp-Sewer05.JPG` 벽/통로/수면, `smp-Sewer06.JPG` 발판/계단,
  `smp-Sewer01.png` 기본 수중 바닥 표시를 직접 확인했다.
- [사용 조건](https://yms.main.jp/dotartworld/page1/rule.html): 일반 도구 사용 가능 표기,
  개변 가능, 소재 재배포 불가, 공개 작품에 Pixel Art World / ドット絵世界 크레딧.
  공식 내장 샘플에서 따로 언급한 RTP 벽은 이 두 원본의 부품으로 가져오지 않는다.

## 입력과 생성

`prepare-pixel-art-world-school-sewer.mjs`는 픽셀을 읽지 않고 고정 좌표/배열을 생성한다.
출력 `school-sewer.json` → `pixelArtWorldSchoolSewerCatalog.json`은 동일 메타데이터다.
원본 8열/번호는 유지하고 추가 아틀라스는 만들지 않는다.
`attachPixelArtWorldSchoolSewer`가 실제 사용자 PNG에서 정상/오류 그림과 전체배열을 만들고
타일셋 용도, 10개 구조객체의 소유 참고문서에 함께 넣는다.

- 장소3: 목조교정13×10, 하수도 정비통로10×9, 투명 칸막이5×5.
- 별도 구조7: 교사11×6, 석축출입구6×3, 창/문 각4×4,
  계단발판7×5, 드럼통3×4, 수면단면5×6.
- 상위 투명 조각 아래는 실제 불투명 하위 타일을 보존한다.
- 물/수중바닥은 막힘. 발판의 통과 상위 타일은 엔진 ★로 하위 마른바닥을 따른다.
  계단 가운데를 실제로 위아래 이동하는 것은 양쪽의 차단 난간 배치 덕분이다.
  방향 비트나 고도 엔진을 새로 구현한 것이 아니다.
- 아치 아래 중앙은 투명한 개구부로 보존하되 헤더는 막는다. 뒤쪽 접근은 옆으로 우회한다.
  캐릭터가 아치 헤더 아래로 관통하는 연출/가림 지원을 주장하지 않는다.
- 닫힌 학교 양문은 막혀 있고 바로 남쪽 두 칸에 접근한다. 조사 전이/실내 연결은 별도다.
- 한 단계 계단·전면 지붕·돌담은 고정 완성 형태만 지원한다. 측면 계단/기념석/다른 지붕형,
  시트의 미검토 조각을 이 도안 지원 수에 포함하지 않는다.

## 로컬 준비만 하는 명령

```bash
node scripts/content/prepare-pixel-art-world-school-sewer.mjs
node scripts/content/prepare-pixel-art-world-school-sewer-library.mjs \
  http://127.0.0.1:9878 /absolute/user-originals \
  /private/current-portable.json /private/source-proof.json \
  output/paw-school-sewer/prepared
```

실제 browser importer가 원본 SHA/크기와 현재 카탈로그를 확인한다. PNG 원본 bytes,
400/376 번호, 모든 객체·AI 문서 전체 배열, 하위 알파255, 오류 좌표 일치를 확인한다.
실제 `collision.ts`의 `canMove/isPassable`로 세 장소의 접근/차단/고립통과칸을 관찰하고
실제 타일셋 스키마를 적용한다. 전체 테스트/게이트를 호출하지 않는다.

출력 library는 안정 shared ID, 2 tilesets/assets, 3 places/roots, 10 nested structureKits,
actual PNG/MD를 포함한다. `proof.json`에는 호스트 읽기 영수증·입력 메타/원본 SHA·경로가 있다.
이것은 준비물이며 정본 저장/공용 게시 완료 증거가 아니다. 실제 저장은 감독자만 수행한다.

## 별도 물줄기 인계

`sewer-water-dependencies.json`은 현재 미등록 `SC-Water01/02`의 정확한 SHA/사각/알파 경계와
후속 구현 입력이다. 이 팩에는 자산이나 이벤트를 등록하지 않는다.

작은 것은 128×128, 가로4위상 × 세로4부품이다. 한 위상에서 행0/1은 배수구+이음,
행2는 반복 물기둥, 행3은 물보라다. 길이 후보는 `[0,1] + [2]*n + [3]`이며
n=0/1/3을 네 위상 모두 실제 조립해 보았다. 행1을 반복하면 배수구 끝이 중간에 재등장하므로 금지다.
큰 것은384×640지만 실제4위상은 첫160px의96×160 사각에만 있다.
아래480px는 전부 투명하므로12개의 추가 유효프레임으로 등록하지 않는다.
속도, 프레임 순환 명령, 여러 부품의 위상동기화, 실제 player 앵커/수면 접합은 아직 지원하지 않는다.
기존 Fountain 항목은 동일 자료가 아니므로 대체하지 않는다.
