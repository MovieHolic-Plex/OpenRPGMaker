# Pixel Art World 시설과 상판 조립

사용자 원본 PNG의 좌표만 배포하며 원본/합성 픽셀은 사용자 로컬 자산에 둔다.
`tiledata/pixel-art-world/tabletop-composites.json` → `scripts/content/prepare-pixel-art-world-tabletops.mjs` →
`src/assets/pixelArtWorldTabletopComposites.json`이 공통 조립 메타데이터 경로다.
`appendPixelArtWorldComposites`는 기존 아틀라스 원본 영역의 보이는 RGBA를 확인하고
끝에6종(책상2·도서관2·상점2)을 추가한다. 기존 칸 번호와 통행은 보존한다.
소품 전체 사각형은 원본에서 그대로 가져오며 불투명 밑동2행이 실제 상판에 놓이는지 검사한다.
소품의 상위 칸이 책상을 지워 버리지 않도록 완전 가구를 단일 상위 조립으로 만든다.

일반 다운로드 importer도 같은 조립 함수를 쓴다. `sourceDataUrl`은 원본 SHA 확인용,
`dataUrl`과 `imageWidth/imageHeight`는 확장된 실제 아틀라스다. 둘의 높이나 해시를 혼동하지 않는다.
오브젝트 `structureKits`와 타일 `referenceDocuments`에 전체 배열과 그림을 함께 둔다.

`tiledata/pixel-art-world/compact-civic.json`은 정본의5시설 전체 배열·가구 원점·접근칸·문턱이다.
`scripts/content/revise-pixel-art-world-civic-completion.mjs`는 확인된 이전 아틀라스 SHA/count를 요구하고
상판 조립과 의원 북향 원본 의자254를 적용한다. 도시 transfer의 원본/page 양쪽을 새 출현칸으로
수정하고, 출구를 남쪽 문턱으로 옮겨 입장 즉시 귀환을 막는다. 편의점은 남쪽 직원,
패스트푸드는 남쪽 조작 POS 작업대와 주문대를 분리한다. 접수대 뒤 직원 바닥을 확보한다.

저장: `scripts/content/save-pixel-art-world-patch.mjs`는 sourceProjectId·이전 maps/tilesets/assets를 확인한 뒤
호스트 backup, assets.put, expectedSha 저장, 같은 저장소 재로드를 수행한다.
공용 publisher는6합성 오브젝트를 보존하고, 검토한 전체 배열과 정확히 일치하는 시설만
검토 루트에 추가한다. 장소에는 가구/접근 지침, 지역에는 업데이트된 도시 transfer를 함께 보관한다.

2026-09-24 관찰: 정본 revision35에5시설/도시 연결·5타일셋·4그림 저장 재로드,
공용21타일셋·238오브젝트·18장소·1지역 게시 재로드, revision36 공용 투영에서12맵 보존.
AI 실제 읽기로5타일·5장소·72오브젝트(전체 평면 킷 포함)·1지역 문서308개/331페이지와
이미지298회 전달을 확인했다. 이 숫자는 전 카탈로그 지원 완료를 뜻하지 않는다.
개별시설 지도는 의원13×11, 편의점12×12, 사무실10×10, 패스트푸드12×13, 도서관12×10.
패스트푸드는 외곽 축소가 커서 맨바닥은58→55칸에 그친다. 모든 시설이 빈틈없이 조밀해졌다고 주장하지 않는다.
실제 픽셀/저장/브라우저 근거는 Git 제외 `output/paw-civic-completion/`에 둔다.

전용 player.html 실행에서5시설 41고유 접근좌표44회, 출구5개, 추가 도시문3개 왕복과 실제314회 이동을 관찰했다.
실행 전/후 전체 프로젝트와 도시+5시설 map SHA가 정본revision35와 일치했다.
후속revision37 문 자산 설치 뒤에도 전체12맵이 같은 배열/이벤트임을 확인했다.
애플리케이션/페이지 오류0, HMR 전송 오류3은 별도 기록했다. 빌드56.72초 완료, 실제 편집기 의원 렌더와 Gate-Euro03 다운로드 카드를 확인했다. 전체테스트/게이트/typecheck는 실행하지 않았다.
