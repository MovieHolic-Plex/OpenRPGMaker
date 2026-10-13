# gothic_manor 실내 · 기물 · 참고문서 · 조수 경로 (2026-10-13)

호러·추리·미술관 무대용 고딕 저택 칩셋의 **실내·기물 쪽**이다. 야외 칩셋 정의는 다른 작업(agent/gothic-out)이 소유한다.

## 기물 (코드 손 도트, 자체 완결)
- 원본: `scripts/content/gothic-interior/{glib.py,pieces.py}`. 램프는 beodeul_city 보다 한 단계 낮춘 청회색·검붉음·고사목 갈색. 결과 PNG: `tiledata/gothic-interior/pieces/`.
- 34종 + 애니메이션 스트립(촛대·벽등 불꽃, 번개 창, 안개) — 전부 `object-gate review` PASS(gemini-3.8-flash x4 다수결, 영수증 `harness-data/object-gate/receipts/`).
  전시실(액자 3크기·조각 받침·유리 진열장), 서재(책장·책상·흔들의자·안락의자), 거실(피아노·콘솔), 욕실(피 욕조·세면대·갈라진 거울), 지하실(통·상자·포도주 선반·석관), 침실(침대·옷장·인형 상자), 샹들리에, 촛대, 거미줄, 바닥 4종·벽지.
- 탈락(4판 미통과, 쓰지 않음): 차단봉 `rope_post`, 샹들리에 흔들림·불꽃 프레임. 정적 샹들리에만 통과.
- 시트/번들 굽기·타일셋 정의는 아직 없다 — 칸 번호는 굽기가 정한다(이 문서·참고문서에 번호 없음). 굽기 스크립트에는 `require_all` 을 건다.
- 확인: `python3 scripts/content/gothic-interior/viz.py` → `~/claude-viz/gothic-interior.html` (현재 그림 해시의 영수증 판정).

## 참고문서 (번들 소유)
- 정본: `scripts/content/gothic-interior/plans.py`(저택 1·2층·은신처 예제 + 좌표 검증 + 정상/오류 그림) → `scripts/content/prepare-gothic-interior-references.py` → `src/assets/gothicInteriorReferences.json`(이미지 경로 `/assets/gothic-interior-references/*`).
- `src/project/defaults/gothicInteriorReferences.ts`: `createGothicInteriorReferences()` / `ensureGothicInteriorReferences(tileset)`. **배선 대기**: gothic_manor 타일셋 정의가 `referenceDocuments: createGothicInteriorReferences()` 로 쓰고 `ensureBundledTilesets` 에서 ensure 를 부른다.
- 검증 코드: E_BOUNDS · E_OVERLAP · E_DOOR_ACCESS_BLOCKED · E_DOOR_UNREACHABLE · E_HIDE_ACCESS · E_STAIR_MISMATCH. 범위는 구조·통행(BFS)뿐.

## 조수 경로
- `src/ai/gothicPolicy.ts`(jpCityPolicy 모양): 칩셋이 프로젝트에 **있을 때만** 라우팅. 낱말 저택·묘지·폐성·고딕·호러·미술관·갤러리·고아원·정신병원. 판타지 성·왕궁·마왕성은 강한 고딕 낱말이 없으면 안 끌림.
- 배선: `plainTurn.ts`(대상·노출 도구·감사), `executionRoute.ts`(노트), `systemPrompt.ts`(포인터·상세 줄), `startVariety.ts` KIT_BUILD_LINES, `harness-data/game-concepts/seed.json` tilesetHints.
- **아직 안 한 것:** `src/concepts/format.ts` 의 `BUILDABLE_CONCEPT_TILESETS` 에 gothic_manor 추가(번들 타일셋이 생긴 뒤), 컨셉 카드 변형 tilesetId.
- 테스트(작성만, not run): `test/gothicPolicy.test.ts`, `test/gothicInteriorReferences.test.ts`.
