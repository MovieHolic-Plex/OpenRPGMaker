# 공용 캐릭터·얼굴 재매핑 — 2026-09-18

사용자가 기존 매핑 파일을 찾을 수 없어 원본 그림을 직접 대조하여 새로 저작했다. 과거 수동 저장본의 복구라고 주장하지 않는다.

- 공용 원본: `src/assets/sharedCharacterGraphics.json`
- 21개 시트 × 8칸 = 168칸을 검토. 연결 94칸(정확 68, 근사 26), 얼굴 없음 74칸. 원본 낱장 얼굴 80개에 독립 메타데이터를 기록.
- Actor 32/32, People 36/40, 동물 7/8, Monster 17/24, farming 2칸 연결. 객체·탈것·템플릿·빈 슬롯과 전용 얼굴이 없는 Scarloxy 캐릭터는 연결하지 않았다.
- 근사 대응은 각 행 `note`에 피부·머리·장식·작화 차이를 기록. 검은 고양이에게 개/갈색 고양이 얼굴을 지정하지 않고, 중절모 신사에게 어린이 얼굴을 지정하지 않는다. Actor3 #5 무도가에게 기존 인덱스의 여성 얼굴을 그대로 주지 않는다.
- PNG는 실제 `applyCharsetFrameCrop`과 원본 낱장 PNG를 사용하는 브라우저 캡처다. AI 이미지 생성이나 자동 유사도 매칭 결과가 아니다.
- 호스트 저장: `/home/main/.local/share/oprn/character-graphics.json`, 저장 후 재읽기 성공(`host-reload.json`). 이 자료는 프로젝트 폴더·빌드 결과와 독립적이다.
- Supabase 보관: `rpg_zzu.projects.project_id = oprn-shared-character-graphics`. 새 전용 프로젝트 행을 생성(HTTP 201)하고 재조회하여 168/94/74 및 68/26을 확인했다(`supabase-reload.json`). 편집기의 운영 저장소는 호스트 공용 파일이며 Supabase 행은 이 저작 결과의 원격 보관본이다.
- 코드 확인: `build:app`, `build:electron` 완료. vitest/게이트는 세션 명시 요청이 없어 실행하지 않았다. 격리된 별도 카탈로그를 사용한 Firefox에서 프로젝트 간 유지, 게임 문서 불변, 충돌 실패 표시·복구 JSON을 관찰했다.

연결된 인물: [Actor](mapped-actor.png), [People](mapped-people.png), [동물](mapped-animal.png), [몬스터](mapped-monster.png).
- 빌드된 Vite preview 표면(`preview-authored.png`)에서도 새 매핑을 확인했다. 실제 HTTP 요청으로 첫 저장 200 → 오래된 revision 저장 409 → 원본 복원 200과 동일 revision을 관찰했다(`preview-proof.json`). 이 동시성 관찰은 운영 파일과 분리된 임시 카탈로그에서 실행했다.
