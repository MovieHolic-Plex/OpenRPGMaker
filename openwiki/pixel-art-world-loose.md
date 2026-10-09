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
## 검토 판본의 사용자 로컬 공용 게시 준비

`prepare-pixel-art-world-loose-library.mjs --prepare <review-bundle.json> <원본폴더> <source-proof.json> <shared-before.json> <output/개인폴더>`는 파일만 읽어 `pixel-art-world-loose-local` 라이브러리와 준비 근거를 만든다. 독립 검토 report의 미해결 발견0, 최종 metadata SHA 및106prepared 전체를 묶은 review-bundle의 모든 artifact SHA가 현재 파일과 같아야 한다. 입력이 바뀌면 과거 시각 승인을 재사용하지 않고 거절한다. 준비 스크립트가 새 시각 승인을 발급하지 않는다.

원본 SHA/실제크기, prepared source-inventory의 전체 pack, 각 kit 소유 MD의 recipe, 전체 stamp 배열을 현재 metadata와 대조한다. 원본106종은16px 참고용(객체kit0), 파생103종은32px 조립용(539kit)이다. tile/asset/kit와 중첩 MD/이미지 참조까지 reserved `shared_paw_loose_*`로 치환하고 실제 schema와 owned image 링크를 확인한다. 방/지역/이벤트는 만들지 않는다.

원본 asset은 사용자 PNG의 바이트를 그대로 보존한다. 브라우저 Canvas의 반투명 RGB 재정규화 때문에 준비용 source PNG에 **raw RGBA exact**를 주장하지 않는다. 원본 대비 알파·premultiplied 채널이 정확히 같은지 확인한다. 상판 합성 이외의 source→atlas 복사는 정규화된 원본의 실제 보이는 RGBA와 대조한다. 상판 합성은 이미 독립 검토된 atlas SHA/전체 metadata/배열을 보존한다.

문서 이미지만 기존 lossless WEBP 도구로 압축하고 디코딩 후 픽셀 동일을 확인한다. 실제 게임 asset 바이트는 바꾸지 않는다. preparation-proof에 전체 JSON bytes, 중복 포함 reference image bytes, MD 크기와 고유 이미지 압축량을 남긴다.11 source-only 영역 및19파일의 미배정 픽셀은 여전히 완성 조립 미지원이다.

`publish-pixel-art-world-loose-library.mjs --publish-local <준비폴더> <개인결과폴더>`만 로컬 SQLite 게시 API를 연다. 준비 산출물의 preparation-seal.json이 proof/library/reviewBundle SHA를 묶으며 canonical receipt/shared snapshot 파일 SHA도 보존한다. 게시 직전 이 seal과 입력 영수증·검토 bundle·현재 metadata·원본·library SHA를 다시 검사하며, 준비시 shared snapshot에서 고정한 해당 library revision으로 CAS한다. 다른 library/정본 프로젝트는 수정하지 않는다. 새ID가 다른library에서 사용되면 거절한다. 같은 대상을 다시 읽어 payload 일치를 기록한다. 부모 담당자가 실제 게시와 정본 save/reload/UI 검토를 수행한다.

## 공용·기존 정본·새 SQLite 확인 (2026-09-24)

검토 판본을 별도 `pixel-art-world-loose-local`에 게시하고 재로드 일치를 확인했다.
원본 참고106개/배치용103개/객체539개이며, 기본 자료와 합쳐 게임용155타일셋·원본참고106·문서소유3개다.
정본 revision45에서209타일셋·209자산 실제 바이트를 재로드하고 기존12맵을 보존했다.
AI 도구1932MD/1979페이지/2262이미지 전달을 확인했다(동일 출처의 객체별 재조회 포함).
실제 새 SQLite 프로젝트도 공용264타일셋·346자산이 자동 설치되고 revision2에서 일치했다.
이는 조립 객체 및 참고자료의 설치 증거이며11보류영역/19잔여파일이나 소품의 새 실행 맵을 완성한 것은 아니다.
증거는 Git 제외 `output/paw-loose-install/{shared,saved,document-observations.json,automatic-project-proof.json}`.
