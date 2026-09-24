# Pixel Art World 개별 소품 가져오기

카탈로그 28의 106 직접 PNG 전판을 원본 보존과 수동 객체로 나눈다. 출처·정확한 제한·파일별 범위는 `tiledata/pixel-art-world/LOOSE.md`, 좌표·SHA 메타데이터는 `loose.json`.

- `scripts/content/prepare-pixel-art-world-loose.mjs` → `src/assets/pixelArtWorldLooseCatalog.json` (픽셀 없음).
- `src/project/pixelArtWorldLoose.ts`: 16px 보존용 원본 타일셋, 32px 여백 포장 객체 타일셋, 전체 배열 kit/group. 16px를 원본 객체 격자로 취급하면 안 된다.
- `src/editor/pixelArtWorldLooseImport.ts`: 파일 SHA/크기/alpha 경계를 확인하고 식탁 합성·원본 참고·정상/오류 실물 및 kit별 owned 문서를 생성한다. pure prepare와 실제 store 변경을 분리했다.
- `src/editor/panels/pixelArtWorldLooseCatalog.ts`: 기존 외부 칩셋 모달의 전용 카드. 일반 native8열 시트 importer를 거치지 않는다.
- `scripts/content/render-pixel-art-world-loose.mjs`: 브라우저 prepare만 사용한 개인 결과와 install-plan. 프로젝트/DB는 쓰지 않는다.

완성 조립 539개, source-only 11영역, 19파일 잔여 미분류 픽셀. 원본 전체 보존 106개를 전체 객체 조립 완료로 보고하지 않는다. 원본/파생 픽셀을 Git/public에 넣지 않는다. 정상 사용자 가져오기는 structureKits까지 연결한다. 원본 참고 타일셋은 객체 없는 보존 자료다.

공용 등록 담당자는 prepared의 생성 UUID를 변경할 때 tileGroups/structureKits 참고문서의 실제 tilesetId 표기도 함께 치환한다. 실제 배치 오브젝트는 하위 -1, 상위 전체이며 다른 상위 가구 위에 겹쳐 찍으면 지워진다. 식탁 소품은 이미 합성된 전체 객체를 사용한다. 정적 그림의 문/애니메이션/상호작용 기능을 암시하지 않는다.

## 통합·실제 UI 관찰 (2026-09-24)

소품 카드도 공통 검색이 사용하는 `dataset.search`에 파일명/이름/객체명을 제공한다.
빠뜨리면 검색어 입력 또는 지우기 이후106카드가 모두 사라진다.
독립 그림 검토 후 바리케이드3·돌더미1·방향11·나무 밑동2의 metadata를 수정했다.
원본106/정상539 전판과 수정된 prepared/owned MD를 대조했다. source-only/잔여는 미완료다.
빌드된 UI에서 momiji.png + ST-Icecream-I01.png를 파일입력으로 가져오고 별도 SQLite 프로젝트
revision7에서 원본 참고/완전객체2타일셋·2자산을 새 페이지로 다시 읽었다. 완전객체의 마지막행
충돌은[0,1,1,0], 다른행은 통과로 보존된다. 공용 전체 게시와 이 개별 사용자 가져오기는 구분한다.
근거 Git 제외 `output/paw-loose-independent-review/`, `output/paw-loose-install/`.
