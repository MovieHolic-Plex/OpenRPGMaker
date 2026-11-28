# Standalone harnesses

각 하위 폴더는 에디터 없이 복사해 실행할 수 있는 독립 도구입니다.

- [pokemon-like-characters](pokemon-like-characters/README.md) — 공개 저장소에는 없음(원작 그림 판형, 로컬 사본 전용): 판형 기반 16×32 걷기 캐릭터 수정, GIF 검수, 사용자 Allow/Deny, 엔진 중립 내보내기.
- [object-gen-v2](object-gen-v2/README.md) — 비공개 서브레포 `MovieHolic-Plex/object-gen-v2` 사본(`npm run object-gen-v2:sync`, 공개 스냅샷 제외): Carbon Medium(`gemini-4-carbon`, `medium`) 순수 1-Pass 3/4 픽셀아트 기물 대량 생성·팔레트/이진알파 검증(`verify`)·4배율 검수판(`sheet`)·`oprn-store-pack/1` 컴파일(`pack`).

에디터 전용 어댑터는 이 디렉토리 밖에 둡니다. 공통 실행 시 에디터 registry, Vite, project store, 환경 키를 가져오지 않습니다.
