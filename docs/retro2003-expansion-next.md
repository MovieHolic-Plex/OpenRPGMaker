# retro2003 다음 확장 설계 (2026-09-28)

`src/project/defaults/generatedEnemyRecords.ts` 100종 = 도트 시트가 이미 붙은 6종(slime-red·spider-cave·wisp-blue·wolf-grey·zombie-rot·skeleton-archer)
\+ `retroMonsterPlan.ts` 30종(2026-09-28 기준 PNG 20장 존재, 나머지는 다른 에이전트 진행 중) + **도트 시트도 계획도 없는 64종**이다
(요청 문구의 "60종"보다 4종 많다 — 레코드를 스크립트로 대조한 실측).
기존 슬라임·박쥐·골렘·드래곤 시트는 `generated-enemy-*-01` id 에 붙어 있어 레코드의 `slime-blue`·`bat-cave`·`golem-stone`·`dragon-red` 와 이어져 있지 않다.
시트 규격·motion 7종(hop·swoop·stomp·dash·float·shoot·breath)은 `pixelEnemySheets.ts` 머리 주석을 그대로 따른다.
셀은 **아군과 같은 48px 가 기본**이다(3차 수정: 64px 첫 판이 아군보다 컸다). 64 는 덩치가 분명한 적, 96 은 보스만.

## 1. 몬스터 64종 도트 우선순위

우선순위 기준: **P1** = 기본 트룹·초반 필드에 실제로 나오거나 같은 계열 시트를 팔레트·부품만 바꿔 뽑을 수 있는 것(비용 낮음·노출 큼),
**P2** = 중반 계열 대표, **P3** = 후반 희귀·보스. "재사용" 열은 기존 생성기에서 가져올 뼈대(`scripts/asset-gen/pixel-enemy/<원본>.py`).

| 순 | id | 이름 | Lv | 셀 | motion | 재사용 | 핵심 실루엣 |
|---|---|---|---|---|---|---|---|
| P1 | slime-blue | 푸른 슬라임 | 1 | 48 | hop | slime | 기존 slime 팔레트 사본(리소스 id 매핑만) |
| P1 | slime-green | 초록 슬라임 | 2 | 48 | hop | slime | 초록 팔레트, 풀잎 한 장 |
| P1 | slime-metal | 금속 슬라임 | 3 | 48 | hop | slime | 은색 3단 명암·반사 점, 도망 빠름 |
| P1 | slime-king | 슬라임 왕 | 3 | 64 | hop | slime | 1.3배 몸 + 금관, 착지 흔들림 |
| P1 | bat-cave | 동굴 박쥐 | 6 | 48 | swoop | bat | 기존 bat 사본(리소스 id 매핑만) |
| P1 | golem-stone | 돌 골렘 | 26 | 64 | stomp | golem | 기존 golem 사본(리소스 id 매핑만) |
| P1 | skeleton-bone | 해골 | 16 | 48 | stomp | skeleton-archer | 활 대신 녹슨 검, 방패 없음 |
| P1 | wolf-dire | 다이어 울프 | 11 | 64 | dash | wolf-grey | 검은 털·흉터, 64px 로 키움 |
| P1 | goblin-brute | 고블린 폭력배 | 31 | 48 | stomp | goblin-scout | 곤봉·뱃살, 단검 삭제 |
| P1 | spirit-earth | 땅의 정령 | 22 | 48 | float | spirit-fire | 바위 조각 몸, 떠 있는 자갈 3개 |
| P1 | spirit-wind | 바람의 정령 | 22 | 48 | float | spirit-water | 연녹 소용돌이 몸 |
| P1 | spirit-light | 빛의 정령 | 23 | 48 | float | spirit-fire | 흰·금 십자 광배 |
| P1 | spirit-dark | 어둠의 정령 | 23 | 48 | float | spirit-water | 보라 연기 몸, 붉은 눈 |
| P1 | dragon-red | 붉은 용 | 37 | 96 | breath | dragon | 기존 dragon 팔레트 교체 |
| P1 | dragon-blue | 청룡 | 38 | 96 | breath | dragon | 청색·수염, 얼음 숨 |
| P2 | ooze-black | 검은 점액 | 4 | 48 | hop | slime | 흘러내리는 방울, 눈 없음 |
| P2 | ooze-acid | 산성 점액 | 5 | 48 | hop | slime-red | 연두 거품 점멸 |
| P2 | slime-cube | 젤리 큐브 | 4 | 48 | hop | slime | 각진 입방체, 안에 뼈 하나 |
| P2 | spider-widow | 과부 거미 | 7 | 48 | dash | spider-cave | 검정 + 붉은 모래시계 무늬 |
| P2 | beetle-horn | 뿔 딱정벌레 | 8 | 48 | dash | — | 긴 뿔로 들어올리기 |
| P2 | centipede-fire | 화염 지네 | 9 | 48 | dash | — | 마디 6개 파도 이동, 등 불꽃 |
| P2 | moth-dust | 가루 나방 | 9 | 48 | swoop | bat | 넓은 날개 눈무늬, 가루 입자 |
| P2 | ant-soldier | 병정 개미 | 10 | 48 | dash | spider-cave | 큰 턱, 다리 6 |
| P2 | tiger-saber | 검치호 | 12 | 64 | dash | wolf-grey | 줄무늬·긴 송곳니 |
| P2 | rat-giant | 거대 쥐 | 13 | 48 | dash | wolf-grey | 긴 꼬리, 앞니 |
| P2 | bird-hawk | 매 | 13 | 48 | swoop | bat | 접은 날개 급강하, 발톱 |
| P2 | cat-shadow | 그림자 고양이 | 13 | 48 | dash | wolf-grey | 검은 실루엣 + 노란 눈만 |
| P2 | ghoul-grave | 무덤 구울 | 17 | 48 | dash | zombie-rot | 네 발로 기는 자세 |
| P2 | wraith-dark | 어둠 망령 | 18 | 48 | float | ghost-pale | 검은 누더기, 낫 |
| P2 | banshee-wail | 밴시 | 19 | 48 | float | ghost-pale | 긴 머리, 입 벌린 비명 칸 |
| P2 | sylph-air | 실프 | 24 | 48 | float | spirit-water | 잠자리 날개 요정 |
| P2 | undine-sea | 운디네 | 25 | 48 | float | spirit-water | 물고기 꼬리 하체 |
| P2 | salamander-flame | 샐러맨더 | 25 | 48 | dash | — | 불꽃 도마뱀, 꼬리 불 |
| P2 | golem-clay | 점토 골렘 | 27 | 64 | stomp | golem | 흙색·손가락 자국 |
| P2 | golem-crystal | 수정 골렘 | 27 | 64 | stomp | golem | 반사 면 3색, 어깨 결정 |
| P2 | kobold-digger | 코볼트 광부 | 32 | 48 | dash | goblin-scout | 곡괭이·헬멧 등불 |
| P2 | mage-rogue | 이단 마법사 | 33 | 48 | shoot | orc-shaman | 후드·보라 구체 |
| P2 | knight-fallen | 타락한 기사 | 33 | 48 | stomp | skeleton-knight | 검은 갑옷·붉은 눈구멍 |
| P2 | ogre-club | 오거 | 35 | 64 | stomp | troll-cave | 64px 축소판, 가시 곤봉 |
| P2 | imp-mischief | 임프 | 35 | 48 | swoop | gargoyle-stone | 작은 뿔·박쥐 날개·삼지창 |
| P2 | dragon-whelp | 새끼 용 | 36 | 64 | breath | dragon | 64px, 큰 머리 비례 |
| P3 | worm-sand | 모래 지렁이 | 10 | 64 | stomp | — | 땅에서 솟아 내려찍기(절반은 모래 아래) |
| P3 | goat-mountain | 산양 | 14 | 48 | dash | wolf-grey | 휜 뿔 박치기 |
| P3 | ape-stone | 석상 유인원 | 15 | 64 | stomp | golem | 이끼 낀 석상 원숭이 |
| P3 | deer-forest | 숲 사슴 | 15 | 48 | dash | wolf-grey | 나뭇가지 뿔 |
| P3 | revenant-vengeful | 복수의 사령 | 20 | 48 | float | ghost-pale | 사슬 감긴 유령 |
| P3 | bonepile-crawler | 뼈 무더기 | 20 | 48 | hop | slime | 뼈 더미가 굴러 뭉침 |
| P3 | sword-flying | 부유하는 검 | 28 | 48 | swoop | — | 세운 검 + 보라 오라, 회전 찌르기 |
| P3 | scarecrow-field | 허수아비 | 29 | 48 | hop | — | 막대 한 다리 깡충 |
| P3 | puppet-string | 실 인형 | 30 | 48 | float | — | 위에서 내려온 실 4가닥 |
| P3 | totem-cursed | 저주받은 토템 | 30 | 64 | shoot | — | 제자리, 얼굴 3단 중 하나 발광 |
| P3 | centaur-plains | 켄타우로스 | 34 | 64 | shoot | skeleton-archer | 말 하체 + 활 |
| P3 | fish-piranha | 피라냐 | 36 | 48 | swoop | bat | 물보라 도약 물기 |
| P3 | squid-deep | 심해 오징어 | 37 | 64 | float | — | 촉수 8, 먹물 |
| P3 | shark-land | 육상 상어 | 37 | 64 | dash | wolf-grey | 다리 달린 상어 |
| P3 | eel-electric | 전기 뱀장어 | 38 | 48 | float | — | S 자 몸, 전기 점멸 |
| P3 | griffin-sky | 그리핀 | 38 | 64 | swoop | gargoyle-stone | 독수리 머리 + 사자 몸 |
| P3 | wyvern-cliff | 와이번 | 39 | 64 | swoop | dragon | 앞다리 없는 날개 용 |
| P3 | roc-giant | 거대 로크 | 39 | 96 | swoop | bird-hawk | 보스급 새, 날갯짓 바람 |
| P3 | phoenix-rebirth | 불사조 | 40 | 64 | swoop | bird-hawk | 불꽃 깃, dead 칸 = 재 |
| P3 | dragon-bone | 본 드래곤 | 39 | 96 | breath | dragon | 뼈만, 녹색 숨 |
| P3 | hydra-three | 히드라 | 40 | 96 | breath | dragon | 목 셋, 칸마다 다른 목이 앞 |
| P3 | behemoth-horn | 베히모스 | 41 | 96 | stomp | troll-cave | 네 발 뿔 거수 |
| P3 | angel-fallen | 타락 천사 | 43 | 96 | shoot | — | 검은 날개 6장·빛 창 |

- P1 15종 중 3종(slime-blue·bat-cave·golem-stone)은 **그림을 새로 그리지 않고 `pixelEnemySheets.ts` 의 리소스 id 매핑만** 추가하면 된다. 가장 싸고 노출이 크다. dragon-red·dragon-blue 는 dragon 생성기에 팔레트 인자만 더하면 된다.
- "재사용"은 생성기 모듈을 import 해 부품 좌표·팔레트를 바꾸는 뜻이다. 기존 PNG 를 축소·트레이스하지 않는다.
- 새 motion 이 필요한 적은 없다. worm-sand(솟아오름)·sword-flying(회전)·puppet-string(실)은 기존 motion 에 칸 그림만 다르게 둔다.

## 2. 몬스터 고유 스킬 20개

적 스킬은 지금 `enemyActionArchetypes.ts` 의 공용 스킬(poison_sting·dark·earth 등)만 쓴다. 아래 20개는 **새 SkillRecord + 적 전용 연출 레시피**다.
효과 열은 기존 규칙 필드만 쓴다(새 규칙 없음). 우선순위는 아키타입 규칙(앵커 7, 유료 정체성 8, 보스 turn 버스트 9)을 따른다.
연출 레이어는 아군 직업 스킬과 같은 계약(`RetroFxLayer`: anchor·frame·frames)을 적 쪽에 뒤집어 쓴다 — **projectile 첫 칸은 왼쪽→오른쪽**(적은 왼쪽에 있다).

| id (`skill_mon_` 접두) | 이름 | 쓰는 적 | 적 motion | 효과(기존 필드) | MP | 레이어 (key · anchor · frame×frames) | 방출음(RTP) |
|---|---|---|---|---|---|---|---|
| fire_breath | 화염 브레스 | dragon-red·dragon-whelp·salamander | breath | 전체 불 피해 28 | 6 | mon_breath_fire · screen · 128×10 → mon_burn_hit · allTargets · 64×8 | Fire1 |
| frost_breath | 냉기 브레스 | dragon-blue | breath | 전체 얼음 피해 28 + 민첩↓ | 6 | mon_breath_ice · screen · 128×10 → mon_frost_hit · allTargets · 64×8 | Ice1 |
| rot_breath | 썩은 숨결 | dragon-bone | breath | 전체 어둠 22 + 맹독 | 8 | mon_breath_rot · screen · 128×10 → mon_poison_cloud · allTargets · 64×10 | Darkness3 |
| hydra_triple | 세 머리 물기 | hydra-three | stomp | 단일 3연타(표현) 위력 26 | 0 | mon_bite_triple · target · 64×10 | Attack2 |
| poison_fog | 독안개 | ooze-acid·moth-dust·spider-widow | float | 전체 독 부여 | 4 | mon_poison_cloud · allTargets · 64×10 | Poison |
| sleep_powder | 수면 가루 | moth-dust | swoop | 전체 수면 | 4 | mon_powder · allTargets · 64×8 | Sleep |
| web_shot | 거미줄 | spider-widow·spider-cave | shoot | 단일 민첩↓ | 3 | mon_web_ball · projectile · 32×4 → mon_web_hit · target · 64×8 | Shot1 |
| quake | 지진 | golem-stone·behemoth·worm-sand | stomp | 전체 땅 피해 24 | 5 | mon_quake_crack · allTargets · 64×10 + 화면 흔들림 | Earth2 |
| boulder | 바위 던지기 | ape-stone·ogre-club·troll-cave | shoot | 단일 땅 30 | 3 | mon_rock · projectile · 32×4 → mon_rock_hit · target · 64×8 | Earth2 |
| tail_sting | 꼬리 독침 | scorpion-sand·centipede-fire | dash | 단일 피해 18 + 맹독 | 0 | mon_sting_hit · target · 64×8 | Poison |
| wail | 비명 | banshee-wail | float | 전체 침묵 | 4 | mon_wail_ring · screen · 128×8 | Darkness3 |
| life_drain | 흡혈 | bat-vampire·ghoul-grave | swoop | 단일 어둠 20(흡수는 표현만 — 흡수 규칙 없음) | 3 | mon_drain · target · 64×10 | Darkness3 |
| chain_grip | 사슬 속박 | revenant-vengeful | float | 단일 마비 | 4 | mon_chain · target · 64×10 | Magic2 |
| ink_spray | 먹물 | squid-deep | shoot | 전체 공격↓(명중 대신) | 3 | mon_ink · allTargets · 64×8 | Wave1 |
| shock_field | 방전 | eel-electric | float | 전체 번개 22 | 5 | mon_spark_field · allTargets · 64×8 | Flash3 |
| gale_wing | 날개 돌풍 | roc-giant·griffin·wyvern | swoop | 전체 바람 22 | 5 | mon_gale · screen · 128×8 | Wind8 |
| rebirth_flame | 환생의 불꽃 | phoenix-rebirth | float | 자기 회복 40%(healing, self) | 8 | mon_rebirth · user · 64×12 | Holy2 |
| crystal_shard | 수정 파편 | golem-crystal | stomp | 전체 무속성 20 + 방어↓ | 5 | mon_shard · allTargets · 64×8 | Ice1 |
| dark_judgment | 암흑의 심판 | angel-fallen·demon-lord | finisher | 전체 어둠 36(turn 버스트, 3턴마다) | 10 | mon_dark_sky · screen · 128×12 → mon_dark_hit · allTargets · 64×8 | Darkness3 |
| summon_minion | 부하 호출 | slime-king·goblin-brute | buff | 공격↑ 자기(소환 규칙 없음 — 표현만: 작은 적 실루엣이 옆에 번쩍) | 3 | mon_call · user · 64×8 | Buff |

- 브레스 3종은 공용 `mon_breath_*` 한 벌을 팔레트만 바꾸고, 착탄층(`mon_*_hit`)은 아군 이펙트와 겹치지 않게 적 전용 키로 둔다.
- 흡혈·소환은 **규칙 필드가 없어** 표현만 한다(위 표에 명시). 진짜 흡수·소환이 필요하면 규칙 엔진 작업이 먼저다.
- 런타임: 지금 레시피 테이블(`RETRO_SKILL_RECIPES`·직업 계약)은 아군 전용이다. 적 스킬 연출은 새 계약 파일(`retroMonsterSkills.ts`, 읽기 전용 계약 규칙 동일)과 적 쪽 재생 분기가 필요하다 — 이번 라운드 계약 두 파일은 건드리지 않았다.

## 3. 합체기 6개 (`comboActorIds`)

런타임 규칙(`battleSkillUse.ts`): 참가 2~3명이 모두 참전·생존·준비 상태여야 메뉴에 열리고, 각자 mpCost 와 턴을 쓴다. 멤버는 따로 배우지 않아도 된다.
연출은 finisher 흐름(dim → 컷인 띠에 참가자 **전원** → screen → allTargets)을 쓰고, 컷인 띠는 참가자 수만큼 칸을 나눈다.

| id (`skill_combo_` 접두) | 이름 | 참가 | 조건 Lv | 효과(기존 필드) | MP(각자) | 동작 순서 | 레이어 |
|---|---|---|---|---|---|---|---|
| holy_blade | 성검 일섬 | hero + cleric | 12 | 단일 빛 피해 60, 급소율↑ | 10 | 성직자 cast_raise 로 검에 빛 → 주인공 dash-strike | combo_holy_blade · screen · 128×12 → hero_brave_burst · target (재사용) |
| fortress_meteor | 요새 낙성 | guardian + mage | 16 | 전체 불·땅 45 | 12 | 수호자 방패벽(fortress_wall 재사용) 위로 마도사 메테오 낙하 | guard_fortress_wall · screen → mage_meteor_rock · projectile → mage_meteor_blast · allTargets (전부 재사용) |
| shadow_rain | 그림자 화살비 | scout + ranger | 12 | 전체 피해 38 + 독 | 8 | 정찰병 연막 → 궁수 화살비, 화살촉이 독색 | scout_smoke · allTargets → ranger_arrow_rain · allTargets (재사용, 새 그림 0) |
| thunder_iai | 뇌신 발도 | samurai + mage | 16 | 전체 번개 48 | 12 | 마도사가 하늘을 열고 사무라이가 번개를 칼로 받아 적진을 가름 | combo_thunder_sky · screen · 128×10 → samurai_thunder_hit · allTargets |
| nature_hymn | 숲의 찬가 | druid + bard + cleric | 20 | 아군 전체 회복 60% + 재생 | 10 | 세 명 동시 buff, 꽃잎·음표·빛이 차례로 | combo_grove · allAllies · 64×12 |
| trinity_end | 삼위 종극 | hero + guardian + mage | 22 | 전체 무속성 80(limitSkill) | 20 | 세 필살기 컷인 연속 → 한 화면 대폭발 | combo_trinity · screen · 128×12 → hero_brave_burst · allTargets |

- 6개 중 3개(fortress_meteor·shadow_rain·holy_blade 착탄)는 **기존 시트만으로** 만들 수 있다. 새 그림은 combo_holy_blade·combo_thunder_sky·combo_grove·combo_trinity 4장(128px 3장, 64px 1장)이다.
- 기존 6명(hero·guardian·mage·scout·cleric·ranger) 조합을 먼저, 새 주인공(samurai·druid·bard) 조합은 그 캐릭터 시트가 끝난 뒤에 둔다.
- 재생기 필요 사항: 지금 finisher 컷인은 시전자 한 명의 도트만 띄운다. 참가자 목록을 받아 띠를 나눠 그리는 분기가 필요하다(`retroSkillChoreography` 의 컷인 부분).
