# 게임 도입 연출 연구와 AI 저작 도구 연결

2026-10-03 · RPG/몬스터수집 9사례 + 스타일 비교 10사례 · 목적 표본 조사

## 자료의 범위

공식 개발사·퍼블리셔 문서와 영상 자료를 우선했다. 본편 도입, 타이틀 데모, 공식 opening movie, 홍보 trailer, 공식 이미지, 문서상 시작 흐름을 서로 다른 category로 기록했다. 19개 모두 실제 게임 오프닝을 직접 플레이한 사례라는 뜻은 아니다.

**전체 연속 시청·원작 음악 청취·게임 boot/skip/조작 인계 검증은 하지 않았다.** 직접 시각 검토한 유효 미디어 표본만 참고 PNG로 골랐다. Persona3의 연령 제한, HGSS의 원본 관찰 부족, BOTW 문서 색인만 확인한 범위, Sea의 어두운 표본을 각 사례에 남겼다. 원작 프레임수/fps/레이어 수/보간을 화면만으로 단정하지 않는다.

## 사례 → 표현 → 필요한 도구

| 사례와 출처 | 분류 / 표현 | 도구 연결 | 공개 표본 |
|---|---|---|---|
| [Pokémon Red/Blue: 짧은 대결](https://www.youtube.com/watch?v=_iybdJCo78Y) | `official_rerelease_trailer_showing_game_intro` / 짧은 몬스터 대결 | actor.pose, actor.frameSequence, actor.transform, transition.flash, timeline.cut, audio.cue | 2장 |
| [Pokémon Ruby/Sapphire: 자연과 여행](https://www.nintendo.co.jp/n08/axvp/index.html) · [영상 표본 출처](https://www.youtube.com/watch?v=LnOfUnzle6w) | `game_intro_unofficial_capture` / 자연과 여행 몽타주 | layer.parallax, layer.loopScroll, actor.path, actor.frameSequence, camera.keyframes, timeline.cut | 2장 |
| [Pokémon HeartGold/SoulSilver: 신화·장소 공개](https://bulbapedia.bulbagarden.net/wiki/Game_intro) | `game_intro_secondary_description_not_visually_verified` / 신화적 생물과 장소 공개 — 직접 시각 검증 부족 | actor.transform, layer.occlusion, transition.flash, camera.keyframes, timeline.cut | 0장 |
| [Pokémon Black/White: 의식이라는 질문](https://www.youtube.com/watch?v=NNOjHHOeQg0) | `game_intro_unofficial_capture` / 소품과 인물로 질문을 만드는 의식 | actor.pose, actor.attachment, layer.light, camera.keyframes, timeline.cut, asset.identityReferences | 2장 |
| [Chrono Trigger SNES: 미래 모험의 몽타주](https://www.jp.square-enix.com/chronotrigger/) · [영상 표본 출처](https://www.youtube.com/watch?v=6YCVtCx8Obo) | `title_attract_montage_unofficial_capture` / 실제 게임 공간을 이용한 모험 예고 | scene.mapSnapshot, actor.path, actor.frameSequence, timeline.montage, opening.trackMode, preview.detachedState | 1장 |
| [FINAL FANTASY VI: 설원 행군](https://eu.finalfantasy.com/topics/528) · [영상 표본 출처](https://www.youtube.com/watch?v=jgRZAGQPJVY) | `in_game_opening_unofficial_capture_and_developer_commentary` / 행군 tableau와 크레딧 | actor.loopClip, layer.loopScroll, layer.particles, layer.perspectiveApproximation, text.creditsTrack, audio.continuity | 2장 |
| [FINAL FANTASY VII REMAKE: 세계의 규모](https://na.finalfantasy.com/news/1299) · [영상 표본 출처](https://www.youtube.com/watch?v=8IrheLf0Ki0) | `official_opening_movie_3d_comparison` / 세계의 규모 — 3D 비교 사례 | layer.parallax, actor.transform, camera.keyframes, transition.matchCut, audio.continuity, handoff.restore | 1장 |
| [OCTOPATH TRAVELER 0: 일상 파괴가 동기](https://www.square-enix-games.com/en_US/tagged/platforms%3APC) · [영상 표본 출처](https://www.youtube.com/watch?v=-xSyjJSAkWw) | `game_prologue_documented_and_official_story_trailer` / 일상과 파괴의 대비 | scene.variants, layer.particles, layer.light, actor.path, timeline.cut, caption.safeArea, handoff.stateContract | 2장 |
| [Sea of Stars Sunset Edition: 과거의 영웅과 재앙](https://sabotagestudio.com/press-release/but-what-a-beautiful-sunset-it-is-sea-of-stars-sunset-edition-marks-the-final-update-for-the-game-available-now/) | `new_game_cinematic_documented_and_unofficial_samples` / 과거의 영웅과 재앙 — 2026 Sunset | opening.trackMode, scene.timePeriod, actor.identity, layer.particles, timeline.cut, caption.track, handoff.restore | 0장 |
| [Persona 3 Reload](https://www.sega.jp/topics/detail/240105_5/) | `official_opening_movie` / 노래 중심의 캐릭터 오프닝 — 시각 세부 미확인 | 장면/샷 타임라인, 음악 박자·효과음·목소리 큐, 시간 스크럽/프레임 증거 | 0장 |
| [Persona 4 Golden](https://www.youtube.com/watch?v=t2ZEj8JK2tY) | `official_opening_movie` / 밝은 팝 그래픽 + 캐릭터 전신 구도 | 리미티드 포즈·프레임/홀드, 그래픽/모양 마스크, 타이포/픽셀 자막, 전환과 시간 대비, 음악 박자·효과음·목소리 큐 | 2장 |
| [Persona 5 Royal](https://www.youtube.com/watch?v=O3dX4tCb_5w) | `official_opening_movie` / 붉은색·검정·흰색의 대조 + 과장된 로고/캐릭터 | 리미티드 포즈·프레임/홀드, 그래픽/모양 마스크, 타이포/픽셀 자막, 전환과 시간 대비, 음악 박자·효과음·목소리 큐 | 2장 |
| [The Legend of Zelda: Link’s Awakening (2019)](https://www.youtube.com/watch?v=_U-_XfDGgDw) | `official_announcement_trailer` / 폭풍·환경의 움직임으로 여는 손그림 시네마틱 | 장면/샷 타임라인, 리미티드 포즈·프레임/홀드, 전환과 시간 대비, 투명 조명/안개/환경 FX, 레이어·깊이·움직이는 작은 대상 | 2장 |
| [The Legend of Zelda: Breath of the Wild](https://zelda.nintendo.com/breath-of-the-wild/assets/pdfs/ExplorersGuide.pdf) | `in_game_opening_documented_not_watched` / 목소리로 깨운 뒤 작은 행동에서 넓은 세계로 인계 | 장면/샷 타임라인, 음악 박자·효과음·목소리 큐, 플레이 인계/시작 목표 | 0장 |
| [Hades](https://www.youtube.com/watch?v=Bz8l935Bv0Y) | `official_animated_launch_trailer` / 액션 시네마틱: 근접 악역 → 위협/주인공 → 정적인 인물 구도 | 리미티드 포즈·프레임/홀드, 전환과 시간 대비, 음악 박자·효과음·목소리 큐, 투명 조명/안개/환경 FX | 2장 |
| [Hollow Knight](https://www.youtube.com/watch?v=UAO2urG23S4) | `official_gameplay_release_trailer` / 레이어로 깊이를 만든 손그림 2D + 분위기 조명 | 리미티드 포즈·프레임/홀드, 타이포/픽셀 자막, 투명 조명/안개/환경 FX, 레이어·깊이·움직이는 작은 대상 | 2장 |
| [Undertale](https://undertale.com/about/) | `official_prologue_image_reference_not_video` / 작은 세피아 삽화 + 짧은 픽셀 텍스트 | 리미티드 포즈·프레임/홀드, 타이포/픽셀 자막, 음악 박자·효과음·목소리 큐, 플레이 인계/시작 목표 | 0장 |
| [Stardew Valley](https://www.youtube.com/watch?v=ot7uXNQskhs) | `official_gameplay_release_trailer` / 생활 목표의 짧은 문장 → 실제 활동/풍경 몽타주 | 장면/샷 타임라인, 타이포/픽셀 자막, 전환과 시간 대비, 레이어·깊이·움직이는 작은 대상, 플레이 인계/시작 목표 | 2장 |
| [GRIS](https://www.youtube.com/watch?v=RdrvV25zoA8) | `official_launch_trailer` / 수채 질감·큰 여백·붉은 형태로 감정 표현 | 리미티드 포즈·프레임/홀드, 전환과 시간 대비, 투명 조명/안개/환경 FX, 레이어·깊이·움직이는 작은 대상 | 1장 |

## 공통 강화 순서

1. **배우·레이어를 독립 저작:** 배우 pose/frame/hold/path/attachment와 배경·전경·빛·VFX·문구를 분리한다. 정지 그림의 pan을 걷기나 인물 반응으로 보고하지 않는다.
2. **하나의 시간축:** shot/cut/카메라/전환/자막/audio cue에 같은 clock을 사용한다. scrub·장면별 재생·고정 seed·프레임 증거를 제공한다.
3. **작품에 맞는 표현:** 몬스터 대결은 두 배우, 여행은 환경과 배우의 상대 이동, 의식은 소품/근경, 일상 파괴는 같은 장소의 전후, 팝 오프닝은 그래픽/shape/text 트랙으로 구성한다.
4. **소리와 인계 계약:** BGM identity/currentTime 연속성, 시간별 SE, 완료/skip/cancel cleanup과 실제 첫 조작을 검증한다. 원작 오디오를 들었다는 주장은 이번 연구 범위에 없다.
5. **실제 AI 완료 기준:** 계획과 연결된 자산/샷 일치, 실제 render/preview, 장면 사이 외형·밤/낮·광원·선택 전 상태의 일관성, 비평 후 수정 근거를 요구한다. 계획 JSON과 PNG 생성만으로 애니메틱 완성을 보고하지 않는다.

## 프레임과 저작권·검증 한계

- 25개 참고 PNG, 작품당 최대 2장. 원본 조사 프레임을 복사할 공개 경로는 `/assets/opening-study/<id>-<index>.png`이다.
- PNG는 **연출 연구용 참고 이미지**이며 게임 미디어, 저작 자산, 생성 소재로 등록하지 않는다. 원본 공식/녹화 영상의 URL과 미디어 시간을 함께 보존한다.
- RPG 표본의 `timeSeconds`는 브라우저 실제 currentTime이며 `requestedTimeSeconds`와 약간 다르다. 스타일 표본은 paused seek 시간을 사용한다.
- HGSS TCG 광고, 재편집 intro, Chrono 검은 표본, GRIS readyState=0 시도는 포함하지 않았다. Sea의 가독성 낮은 별 배경/텍스트 표본도 공개에서 제외했다.
- Undertale은 공식 사이트 삽화 관찰이며 유효 영상 프레임 목록이 없어 PNG 참고 목록에서는 생략했다. Persona3/BOTW도 프레임을 발명하지 않았다.
- Chrono SNES와 후대 Toei 영상, Sea of Stars 2023 원본과 2026 Sunset 새 도입, trailer와 본편 prologue를 구별한다.

## 산출물

- `src/assets/openingReferences.json`: 19개 배열. 모든 사례에 출처 URL, claim별 확인 상태, 검증 한계, 공개 referenceFrames를 포함한다. 개인 경로를 포함하지 않는다.
- 공개 참고 그림: `public/assets/opening-study/`. 출처와 시간은 공용 카탈로그에 보존한다.
- 조사는 원작 전체 재생·오디오 청취·게임 조작 검증을 포함하지 않는다.
