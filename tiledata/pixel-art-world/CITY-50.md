# 50×50 도시와 컴팩트 시설

2026-09-24. 사용자 다운로드형 지원을 유지하면서 실제 원본 타일로 구성한 도시다.
그림·합성 atlas·완성 장면 PNG는 사용자 로컬 프로젝트에만 저장한다.
공유하는 것은 SHA-256, 좌표 사전, 전체 배열, 조립·통행 지침과 재현 스크립트다.

## 구성

- 도시 50×50: 건물 8동, 학교·의원·편의점·식당·도서관·사무실·주택 2동, 공원.
- 실내 10맵 / 9종: 교실 14×13, 보건실 11×11, 과학실 13×11,
  의원·편의점·식당 각 14×12, 도서관 12×10, 사무실 10×9, 주택 각 12×11.
- 위 실내 크기는 기본 scene이다. 최종 맵은 사방에 XP 천장 테두리 1칸씩 추가한다.
- 학교 입구는 교실·보건실·과학실 선택, 다른 건물은 바로 입장한다.
  두 칸 문은 양쪽 모두 action 이벤트를 두고, 실내 남쪽 출구는 touch로 보도에 돌아온다.
- 내부 상호작용·상점 거래·NPC 일정은 아직 저작하지 않았다.

## 데이터와 조립

`city-kits.json`은 원본별 건물·공원 부품이다. [CITY-KITS.md](CITY-KITS.md)를 먼저 읽는다.
`prepare-pixel-art-world-city.mjs`는 이 부품으로 `city-50.json`과
`src/assets/pixelArtWorldCity.json`을 생성한다. 각 2,500칸 lower/upper와 166개 합성 타일 사전을 갖는다.
청사진 번호는 원본 시트 번호가 아니다. 같은 픽셀도 통행·레이어가 다르면 사전 항목을 분리한다.
상위가 투명한 지붕·나무에는 불투명 하위 받침을 유지한다. 박공지붕의 바깥 빈 잔디까지 막지 않는다.

공용 카탈로그 11팩과 compact scenes는 `externalTilesetCatalog.ts`로 제공한다.
`externalTilesetImport.ts`는 사용자 PNG에서 참고 그림을 만들며 도시 원본이면
`pixelArtWorldCityGuide`의 원본 사전·전체 배열·건물/입구 4개 MD도 추가한다.
청사진의 나머지 원본과 이동 이벤트까지 자동 설치했다는 뜻은 아니다.
신규·기존 프로젝트 모두 같은 가져오기 경로를 사용한다. 기존 사용자 참고문서를 덮어쓰지 않는다.

## 다운로드와 재현

`download-index.json`: 카탈로그 29페이지에서 공개 링크를 확인한 ST-/SA- PNG 211개
(타일셋 36, 오토타일 175). 해시·치수·URL만 기록한다. 사이트의 모든 종류의 소재를 수집했다는 뜻은 아니다.
다운로드 완료와 의미 분석 완료를 구분한다. 211개 모두의 타일 의미/프레임 형식을 지원한다고 주장하지 않는다.
사용자 로컬 사본은 `/home/main/.local/share/oprn/pixel-art-world-downloads/`에 있다.

```bash
node scripts/content/prepare-pixel-art-world-city.mjs
# 별도 터미널에서 npm run dev:worktree로 에디터 모듈 서버를 먼저 연다.
node scripts/content/author-pixel-art-world-city.mjs <원본폴더> <로컬에디터origin>
node scripts/content/save-pixel-art-world-city.mjs output/paw-city/authored.json <새로컬프로젝트폴더>
```

저작기는 원본 해시를 확인하고 기존 import 경로로 참고문서를 생성한다.
XP WallA01의 47변형을 각 실내 타일셋에 추가한 뒤 천장 외곽에 사용한다.
실제 엔진 `canMove`로 입구·가구 접근칸의 도달 가능성을 확인한다.
저장기는 Electron SQLite 저장소 API를 사용하고 닫기 → 다시 열기 → 전체 JSON 동등성 → 자산 재읽기를 수행한다.
이 스크립트는 실행 중인 호스트가 소유한 프로젝트에 쓰는 용도가 아니다. 원격/LegacyDb에는 쓰지 않는다.

## 저장 근거

- project id: `6ae74f7a-23a2-449b-8171-5afb5dff532b`
- 정본: `/home/main/.local/share/oprn/paw-city-20260924/project.sqlite` + `assets/`
- 재로드 기록: gitignored `output/paw-city/storage-proof.json`
- 전체 맵/자산 재읽기: `canonical-reloaded.json`, `reloaded-portable.json`
- 실제 통행 확인: `assembly-report.json` (도시 도달 가능 1,767칸, 모든 선언된 접근칸 도달)
- 전용 `player.html` 관찰: `scripts/qa/pixel-art-world-city-capture.mjs`, `output/paw-city/SUMMARY.md`

공유 저장소에는 위 이미지나 프로젝트 사본을 추가하지 않는다. 테스트/게이트 전체 스위트는 실행하지 않았다.
