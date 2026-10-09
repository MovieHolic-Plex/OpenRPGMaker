# 2026-07-07 타일 툴 v3 설계 — 승인 보캐뷸러리 + 공정 프리미티브

> 사용자 합의 (2026-07-07 저녁). 배경: v2는 호출 형식 실패(재시도 폭주)는 잡았으나 **모델의 선택 품질**
> (흰 타일을 길로)은 못 잡았다. 저가 모델 전제에서 재량 자체를 회수한다.

## 원칙 0 — Zero-Trust Perception (사용자 명시)
AI의 비전·타일 구분 능력은 **항상 의심**한다. AI 산출물은 전부 '추정' 신분 — 사람의 명시 행위 없이
승인 어휘에 편입되는 경로는 없다. 인간 = 교정자가 정규 워크플로. 단 **결정론적 사실**(투명 픽셀 유무,
크기)은 AI에게 묻지 않고 엔진이 픽셀 검사로 확정해 카드에 '사실 배지'로 병기한다.

## 합의된 축
1. **승인 보캐뷸러리 하드 차단**: 배치 프리미티브는 승인된 어휘만 소비. 미승인 → 즉시 거부+"승인 필요" 안내.
2. **승인의 정의**: ① 채팅에서 어휘 프로포절을 사용자가 **명시 수락**(autoApprove 불인정) ② T1b 위저드/우클릭 교정.
   내부 마킹 `origin:"user"`. **제로 부트스트랩** — 새 프로젝트 승인 집합은 공집합.
3. **승인 단위 = 그룹/패턴**: 9분할 벽, 1×3 기둥, 8-이웃 오토타일 그룹이 패턴 정보와 함께 통째로 승인.
   낱개 타일 승인은 소품류만.
4. **레이어는 어휘의 속성**: `layerHome`(하위/상위/셀별)이 합의 필드. **프리미티브에서 layer 인자 제거** —
   시공 엔진이 어휘 정의대로 결정론 배치. 투명 픽셀 사실 배지와 모순되는 승인은 lint 경고.
5. **grammarProfile**: `TilesetDef.grammarProfile?: string` 기본 `"rm-type"`. 시공 전개는 프로파일
   레지스트리 디스패치. **RM-TYPE**(현행 combined_town 규약: nine_slice 벽/vertical_expandable 기둥/
   8-이웃 variantMap 오토타일(inner corner 포함)/upper·lower 홈)만 1차 구현.
6. **어휘 프로포절 카드 = 수정 후 수락**: 이름/role/패턴 kind/layerHome을 카드에서 인라인 편집 후 수락.
   편집 수락 = origin:"user". UXD 체크박스와 결합(부분 수락+부분 편집). 편집 폼은 T1b 팝오버 재사용.
7. **모델**: 제공자 레지스트리(`src/ai/ohMyPiProviders.ts`)가 해석하는 ID 만 쓴다. 기본은 `src/ai/llmClient.ts` 의 `DEFAULT_MODEL`, 평가 드라이버는 `VITE_LLM_MODEL` 로 덮는다. 스펙에 모델 ID 를 박지 않는다.
8. **v2 처분**: 배치 4종(tile_paint/road/scatter/structure)만 deprecated→v3. 지식 계열 v2 유지.

## v3 도구
- `propose_tile_vocabulary` (write, 프로포절): 미승인 타일/그룹 묶음 제안 — 타일 이미지+패턴 배치 미리보기
  (render_group_sample 재사용)+투명도 사실 배지+AI 추정 라벨. 수락 시 승인 편입.
- `tile_query`에 `ask:"unapproved"` 추가.
- 공정 프리미티브 6종 (전부 layer 인자 없음, 승인 어휘 id만 소비, "다시 보낼 형식 예시" 계약 승계):
  `build_wall(mapId, rect, wallVocabId)` / `build_roof(mapId, roofVocabId, wallRef?)` — 벽 위에만 /
  `place_door(mapId, at, doorVocabId)` `place_window(...)` — 벽 셀에만 /
  `lay_path(mapId, points, pathVocabId, naturalness?)` — 8-이웃 variantMap 필수, inner corner 재계산 /
  `place_props(mapId, area, propVocabId, count, naturalness?)` — 클러스터 hard 유지.

## 채팅 관측성 (동봉)
폰트 크기 조절(영속) / 💭 추론 원문 전체 열람 / 도구 로그 클릭 → 호출 인자·결과 JSON 아코디언.

## 웨이브 (빠르게, 테스트는 간단히 — 사용자 지시)
- **V3A**: 승인 데이터 계층(판정/마킹/제로 부트스트랩)+grammarProfile+propose_tile_vocabulary+unapproved 조회+하드 차단 헬퍼
- **V3C**: 채팅 관측성 3종 (V3A와 병렬 — 파일 분리)
- **V3B**: 프리미티브 6종+RM-TYPE 전개기+v2 배치 deprecated+어휘 카드 인라인 편집+DEFAULT_MODEL 전환
- **V3D**: 제로 상태 실측(어휘 합의 대화→벽→지붕→길) — 감독자. 완료 시 사용자 타일 작업 개시 가능 상태로 배포.

## 진행 기록
- 2026-07-07: 설계 합의(원칙 0 포함). V3A+V3C 병렬 착수.
