# 스킬 도트 연출을 자료집 레코드로 — 설계 (2026-09-30)

사용자 요구: 「연출을 좀 더 잘 설정할 수 있게」 → 구조 변경부터(연출 레코드 + 층 조립), 그다음 손잡이(색·속도·무게·화면)·자동 추천·상태 오라.

## 현재 (PR #1769 까지)
- 연출 = 코드 계약 `RetroClassSkill`/`RetroMonsterSkill`: `motion` 1개 + 순서 있는 `layers: {key, anchor, frame, frames}[]`. 이펙트 시트 910장(`public/assets/generated/pixel-fx/<key>.png`).
- 스킬은 `SkillRecord.retroChoreographyId` 로 계약 연출 1,130개 중 하나를 **통째로** 빌린다. 층을 섞거나 시작 시각·크기·반복을 바꿀 수 없다.
- 시각 계산은 `retroClassSkillTimeline`/`retroMonsterSkillTimeline`(src/player/retroSkillTimeline.ts 계열)이 motion·layers 에서 유도한다.

## 결정 (바꾸지 말 것)
1. **새 자료집 컬렉션** `database.skillChoreographies: SkillChoreographyRecord[]` (프로젝트가 저작한 연출만 담는다).
2. **기본 연출 1,130개는 프로젝트에 복사하지 않는다.** 번들 카탈로그(계약)가 읽기 전용 기본 레코드로 보인다. id = 기존 계약 스킬 id(`skill_hero_flame_sword` …) — PR #1769 의 `retroChoreographyId` 값이 그대로 유효하다. 조회 순서: 프로젝트 레코드 → 번들 기본.
   이유: 1,130 레코드를 모든 프로젝트에 넣으면 문서가 커지고 번들 개선이 기존 프로젝트에 안 퍼진다(공용 참고문서 교훈).
   편집하려면 「복제해서 고치기」 → 프로젝트 레코드(새 id `chor_<slug>`)가 생긴다.
3. 스킬은 계속 `retroChoreographyId` 하나로 가리킨다(프로젝트 레코드 id 또는 번들 id). 레코드 id 가 계약 스킬이면 그 계약(기존 동작 유지).
4. 레코드 모양:
   ```ts
   interface SkillChoreographyRecord {
     id: string; name: string; description?: string;
     motion: RetroSkillMotion;                 // 9종
     layers: SkillChoreographyLayer[];         // 재생 순서
     // 2단계 손잡이 — 1단계에서 타입만 선택 필드로 두고 런타임은 무시해도 된다
     speed?: number;                           // 0.5~2, 접근·복귀 시간 배율의 역수
     weight?: "light" | "normal" | "heavy";    // 히트스톱·흔들림·복귀 (코드의 APPROACH/HITSTOP/RECOVER_SCALE)
     tint?: string;                            // 전체 층 팔레트 프리셋 id(불·얼음·번개·독·성·암…)
     screen?: { shake?: number; flash?: string; dim?: boolean; cutIn?: boolean };
     tags?: { family?: string; element?: string };
     sourceId?: string;                        // 복제 원본(번들 id) — 추적용
   }
   interface SkillChoreographyLayer {
     sheet: string;                            // pixel-fx 키 (frame·frames 는 시트 메타에서 — 저장하지 않는다)
     anchor: RetroFxAnchor;                    // user·target·allTargets·allAllies·screen·projectile
     startMs?: number;                         // 없으면 기존 유도 시각
     scale?: number;                           // 0.5~3, 기본 1
     repeat?: number;                          // 반복 횟수 기본 1
     onHit?: "first" | "each";                 // each = hitSequence 타수마다 착탄 층 반복
     tint?: string;                            // 층별 덮어쓰기(2단계)
     se?: string;                              // 층별 효과음(2단계)
   }
   ```
5. 시트 메타(key → frame·frames)는 한 곳에서: 번들 계약의 층들에서 모은 `RETRO_ALL_FX_SHEETS` + 몬스터 시트. 레코드에 없는 시트 키는 정규화에서 거절.
6. 런타임: 레코드 → 기존 계약과 같은 `RetroClassSkill`-꼴(motion·layers)로 바꾼 뒤 기존 타임라인에 `startMs·scale·repeat·onHit` 만 얹는다. 타임라인 재작성 금지.
7. 정규화·저장 왕복·웹 내보내기(player shim) 보존. 이펙트 PNG 는 vite 가 `new URL(\`…/pixel-fx/${key}.png\`)` 로 이미 번들에 싣는다.

## 단계
- **A1 (데이터·런타임·조수 백엔드)**: 타입·정규화·저장 왕복, 조회 `resolveSkillChoreography(recordOrId)`, 런타임 적용(startMs·scale·repeat·onHit), 조수 도구 `upsert_choreography`(조립·검증: 없는 시트 키 거절 + 가까운 후보) · `list_retro_choreographies` 가 프로젝트 레코드도 보이게 · `duplicate_choreography`. 녹화 하네스로 조립 연출 재생 증명.
- **A2 (편집기·조수 미리보기)**: 자료집 「도트 연출」 탭(번들 기본 = 읽기 전용 「기본」 표시, 복제해서 고치기) + **타임라인 편집기**(동작, 층 줄: 시트 고르기·위치·시작 시각·크기·반복·타마다) + 미리보기 무대 재생 + **움직이는 썸네일 갤러리**(스킬 탭 연출 칸도 이 갤러리로). 조수 `preview_choreography`(프레임 몇 장 한 장 그림 — 비전 판단용).
- **B (손잡이·추천·오라)**: speed·weight·tint·screen·se 런타임 적용, 기믹·속성으로 기본 연출 자동 추천, 상태 지속 오라(스톱 회색·버서크 붉은 맥동·프로텍트 방패·젖음 물방울·독 거품).
