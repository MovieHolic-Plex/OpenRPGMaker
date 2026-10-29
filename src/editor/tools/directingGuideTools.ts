import type { ToolDefinition, ToolExecResult } from "./types";

/**
 * 연출 지침 — 크로노 트리거·FF6 풍 장면을 script_cutscene 비트로 짜는 레시피.
 *
 * 왜 따로 두는가: script_cutscene 설명은 비트의 모양만 말한다. 조수가 실제로 못 하던 것은 «어떤 장면에 무엇을
 * 겹치는가» 였다 — 폭발에 흔들기만 넣고 번쩍임·파편을 빼거나, 유령을 그냥 걷는 NPC 로 두는 식. 고정 텍스트라
 * 한 번 읽으면 되고, 도구 설명을 불리지 않는다(read_retro_skill_guide 와 같은 꼴).
 */
export const DIRECTING_GUIDE = `# 연출 지침 (script_cutscene 비트)

## 원칙
1. 한 박자에 한 감정. 큰 순간은 parallel 로 2~3개를 동시에 겹친다(소리 + 화면 + 인물).
2. 화면을 가리는 효과(모자이크·큰 기울기·통째 칠하기)는 대사 동안 켜 두지 않는다 — 플레이어가 읽고 볼 수 있어야 한다.
3. 오래 남는 효과(distort·look·weather·background)는 컷신 뒤에도 남는다. 장면이 끝나면 되돌린다:
   distort{effect:"clear"}, look{target,reset:true}, weather{weather:"none"}. letterbox 는 자동으로 걷힌다.
4. 카메라는 멈출 때 easing:"easeOut", 무게 있는 이동은 "easeInOut". 일정한 속도(생략)는 기계적으로 보인다.
5. 인물 대상(target)은 "player", 이 맵 이벤트 id, 또는 이벤트 이름. 맵 칸이면 target 을 비우고 x,y.
6. 대화는 «곁에서, 마주 보고». 말 걸기 전에 approach{actor,target}(대상 곁 빈 칸까지 길 찾기 + 대상 바라보기),
   둘이 서로 보게 하려면 faceEachOther{a,b}. 걸음을 moves 로 손으로 늘어놓거나 방향을 "left" 처럼 손으로 고르지 않는다 —
   누가 비켜 서거나 시작 칸이 달라지면 엉뚱한 칸에서 엉뚱한 데를 본다(2026-10-22 첫사랑). say 는 듣는 인물 쪽으로 저절로 돈다
   (to 생략 = 주인공). 멀리서 부르는 줄은 say{…,calling:true} 뒤 approach. 2칸보다 멀리서 말하면 경고 scene-talk-far.

## 장면 레시피
- 중요한 장면 시작: letterbox{size:12,durationMs:500} → camera{mode:"pan",target:인물,durationMs:900,easing:"easeOut"}.
- 다가와 말 걸기: say{speaker:"민호",text:"서하 씨!",calling:true} → approach{actor:"민호",target:"player",wait:true} → say{speaker:"민호",…}.
- 퇴장·등장: exitVia{actor:"민호"}(가장 가까운 문 칸 위까지 걸어가 문 소리와 함께 사라짐 — 그 뒤 switch 로 «떠남» 페이지) · enterVia{actor:"점원",door:"뒷문"}(문 칸에 나타나 한 걸음 들어섬). 걸음을 세어 문 앞에서 지우면 한 칸 앞에서 사라진다.
- 셋이 모이는 대화: approach{actor:A,target:"player"} → approach{actor:B,target:"player",distance:2} → faceEachOther{a:A,b:B} 로 마무리.
- 놀람: emote{target,emote:"exclamation"} + moveActor 한 칸 뒤로(jump). 의문은 "question", 침묵은 "ellipsis".
- 폭발·충돌: parallel[ particles{preset:"explosion",target 또는 x,y}, shake{intensity:6,axis:"both",durationMs:500}, flash{color:"white",durationMs:200} ].
- 화산 열풍·용암 분출·불길 치솟음: 화면 붉은 tint 만으로는 «열풍이 안 보인다» 로 감점된다(2026-10-16). 최고 연출 순간에 parallel[ particles{preset:"fire",x,y}(용암 둘레 서로 다른 칸 3곳 이상, durationMs:1500) , particles{preset:"smoke",target:"player"}, shake, tint ] 로 솟아오르는 입자를 같은 화면에 함께 보인다.
- 독안개·독기·유독 가스: 보라 tint 만으로는 «안개가 피어오르는 모습이 없다» 로 감점된다. weather{weather:"fog",intensity:0.8} 를 같이 깔고(장면 끝에 weather{weather:"none"}) particles{preset:"smoke",target:"player",durationMs:1500} 를 덧는다.
- 다리·바닥 붕괴: 타일을 바꾼 직후 그 칸에 particles{preset:"explosion",x,y} + particles{preset:"dust",x,y} 를 겹쳐 틈이 눈에 띄게 한다.
- 조건부 생존·사망 함정(방독면·화염 반지·동료가 있으면 무사, 없으면 사망) — 두 분기는 정지 화면 한 장으로도 갈려 보여야 한다:
  · 사망 분기: tint(위험 색) + parallel[ particles 2곳 이상 durationMs 1500, weather(fog 등), shake, music se ] → 비명 say → look{target:"player",pose:"fallen"} → 게임오버.
  · 생존(무사 통과) 분기: 주인공을 한 칸에 세워 두고 대사만 치면 «통과 연출이 없다» 로 감점된다(2026-10-17 jrpg_003 45점).
    위험 색조(독=보라, 열풍·용암=붉은/황금빛)·weather{weather:"fog"}·위험 입자(fire/smoke 2곳 이상, durationMs 4500)와 방어 입자(particles{preset:"sparkle",target:"player",durationMs:4500}, particles{preset:"magic",target:"player",durationMs:4500})를 켠 뒤 say(안도·버팀 대사) → moveActor{target:"player",moves:[이벤트 칸을 지나는 3~5걸음],wait:true} 로 위험과 방어 효과가 화면에 살아 있는 채로 걸어서 건너게 하고, 걸음이 다 끝난 뒤에야 tint{color:"neutral",durationMs:600}, weather{weather:"none"} 으로 거둔다(걷기와 동시에 parallel 로 거두면 통과 장면에 위험·방어 효과가 사라져 감점된다). build_scene_setting 을 썼다면 결과 data.survivalWalk.moves 가 막히지 않는 걸음 목록이다.
- 성검·전설의 무기 뽑기: 인물을 그냥 바위 옆에 세워 두면 «뽑는 동작이 없고 칼이 바위에 그대로» 로 감점된다(2026-10-18 jrpg_046 48점).
  인물을 제자리(movement type:"fixed", turn right)에 두고 parallel[ flash{color:"white"}, shake{intensity:6}, music se,
    particles{preset:"sparkle",x,y(바위)} ] → changeTile 로 바위 위칸의 칼을 지움(build_scene_setting 결과 data.swordPull.cells 그대로).
  · 치켜들기: 캐릭터 도트에는 «검을 든 자세» 가 없어 대사만으로는 «치켜드는 동작이 누락» 으로 감점된다(2026-10-18 jrpg_046 48점).
    moveActor{target:인물,moves:[{kind:"turn",dir:"down"}]} 로 정면만 보게 돌린 뒤(주의: 인물에 jump{dx:0,dy:0} 나 move 를 쓰면 바라보는 방향으로 2칸 뛰어 머리 위 성검 밑에서 이탈하므로 절대 쓰지 않는다!) data.swordPull.raise 를 changeTile 로 찍어 인물 머리 위 칸에 칼을 솟게 하고, 같은 순간 particles sparkle(인물) + flash{color:"yellow"} + tint 금빛 + 치켜드는 외침 대사로 맺는다. 칼이 바위에서 사라져 인물 머리 위로 옮겨 간 모습이 화면에 그대로 유지되어야 한다.
- 지진·거대한 발소리: shake{intensity:3,axis:"vertical",durationMs:800}, 잠깐 쉬고 반복. 부딪힘·휘청임은 axis:"horizontal".
- 기절·쓰러짐·잠: look{target,pose:"fallen"} (+ emote "sleep"). 일어날 때 look{target,reset:true}.
- 숨기·무릎 꿇기: look{target,pose:"crouch"}.
- 유령·환영: look{target,pose:"float",alpha:0.6,tint:"blue"} — 빛나는 혼은 picture blendMode:"add".
- 빠른 이동·순간이동: look{target,afterimage:true} → moveActor → particles{preset:"smoke"} 로 사라짐 → look{reset:true}.
- 독·저주·석화: look{tint:"green"} / look{tint:"purple"} / look{tint:"gray"}. 피격 번쩍임은 look{tint:"white",tintFill:true} 뒤 reset.
- 실루엣 등장(역광): look{tint:"black",tintFill:true} → 다가온 뒤 look{reset:true}.
- 마법 시전: particles{preset:"magic",target:시전자,durationMs:1200} → flash{color:"#a070ff"} → 대상에 particles{preset:"heal"|"explosion"}.
- 보물·축복·변신: particles{preset:"sparkle",target,durationMs:1500} (+ music se).
- 물에 빠짐·분수: particles{preset:"splash"}. 착지·멈춰 섬: particles{preset:"dust"}. 불·분노: particles{preset:"fire"}.
- 수중·꿈: distort{effect:"wave",amount:4,durationMs:1500} — 물결은 장면 내내 켜 둬도 읽힌다.
- 회상 진입·복귀(모자이크는 **전환에만**): distort{effect:"mosaic",amount:12,durationMs:500,wait:true} → tint{color:"sepia",durationMs:0}
  → distort{effect:"clear",durationMs:500,wait:true} → 그다음 회상 대사. 모자이크를 켠 채 대사를 이어 가면 화면이 몇 초씩 뭉개져
  인물이 안 보인다(2026-10-02 실측). 돌아올 때도 mosaic → tint{color:"neutral"} → clear.
- 시간 왜곡·현기증: distort{effect:"rotate",amount:8,durationMs:1200} (+ wave).
- 빛기둥·영혼·마법진 그림: picture{action:"show",…,blendMode:"add"}. 그림자·핏빛 물들임: blendMode:"multiply".
- 비 오는 이별·폭풍 전야: weather{weather:"rain",intensity:0.6} / weather{weather:"storm"}. 회상에서 돌아오면 weather{weather:"none"}.

## 예 — 성 안의 폭발
[
  {kind:"letterbox",size:12,durationMs:400},
  {kind:"say",speaker:"병사",text:"폐하, 저것은…!"},
  {kind:"emote",target:"병사",emote:"exclamation",wait:true},
  {kind:"parallel",beats:[
    {kind:"particles",preset:"explosion",x:10,y:6},
    {kind:"shake",intensity:6,durationMs:600},
    {kind:"flash",color:"white",durationMs:250}]},
  {kind:"look",target:"병사",pose:"fallen"},
  {kind:"camera",mode:"pan",x:10,y:6,durationMs:900,easing:"easeOut",wait:true},
  {kind:"say",speaker:"왕",text:"…시작되었군."},
  {kind:"camera",mode:"return",durationMs:600,easing:"easeInOut"},
  {kind:"look",target:"병사",reset:true}
]

## 이벤트 명령으로 직접 쓸 때(upsert_event, 컷신 밖)
- 화면 효과 m2-202-screen-effect fields{effect,value,durationMs}: effect = fadeIn·fadeOut·flash·tint·weather·wave·mosaic·rotate·clearDistortion·letterbox·clearLetterbox·freeze·unfreeze·doorOpen·doorClose. freeze = 만화식 정지 화면(지금 화면을 한 장 찍어 세움, 값 = warm·mono·sepia·cool·none, 컷신 비트 freeze 로도 쓴다). value = 색·날씨·세기·띠 두께% · 문은 "x,y,너비,높이,slide|swing,left|right"(타일 문 그림 왼쪽 위 칸; 엘리베이터 = slide, 여닫이 = swing).
- 화면 흔들기 m2-048-shake-screen fields{intensity:"1"|"3"|"6"|"10",durationMs,direction:"both"|"horizontal"|"vertical"}.
- 파티클 효과 m2-224-particle-effect fields{preset,target:"player"|"this-event"|"event"|"tile",eventId,x,y,durationMs,wait}.
- 모습 효과 m2-225-sprite-look fields{target:"player"|"this-event"|"event",eventId,reset,pose:"keep"|자세,tint:"keep"|"none"|색 이름,tintHex,tintFill/flip/afterimage:"keep"|"on"|"off",angle,opacity(%)}.
- 이벤트 그림 자체를 늘 빛나게(불꽃·유령·마법진 이벤트): 페이지 graphic.blendMode:"add" (곱하기 그림자는 "multiply").
- 주인공 걷기(생존 분기 통과 등) moveEvent{eventId:"@player",route:{moves:[{kind:"move",dir}],repeat:false,wait:true}} — eventId "" 는 이 이벤트(함정 칸)가 걸어간다.

## 전투 연출 (DB 도구)
- 적이 쓰러지는 모습 upsert_enemy collapseEffect: 잡몹 "pixelBreak"(FF6 보랏빛 픽셀 분해) 또는 "flash"(하얀 세 번 점멸),
  보스 "bossSink"(떨며 붉게 깜빡이고 땅속으로 가라앉음, 1.8초), 환영·소환수 "instant". 생략 = 기본 소멸.
- 전투마다 분위기 upsert_troop backdropLayers(최대 4): 동굴 fog, 하늘 성 clouds, 늪 mist, 폭풍 전야 rain, 설원 snow,
  화산·불타는 성 embers, 밤 stars, 성당 lightRays, 수정·마법진 등 중앙 광원 뒤 glow(정지, 청백색 빛무리). 밤 전투를 남색으로 어둡게 night, 불탄 들판·잿더미 smoke(곱하기 겹, 앞 장막 아님). 앞 장막은 front:true + opacity 50 이하(숫자가 가려지지 않게).
  backdropAnimation(배경 한 장 흐르기)은 도트 측면 전투(기본)에서 지형 겹 배경에 가려 안 보인다 — 분위기는 backdropLayers 로.
- 상태가 몸에 보이게 upsert_state battleAura: sleep-zzz(Z) · paralyze-spark(전기) · silence-mute(…) · confuse-stars(별) ·
  charm-heart(하트) · burn-ember(불티) · poison-bubble · freeze-grey · petrify-still · regen-sparkle · dark-fog · berserk-pulse.
  기본 상태(수면·마비·침묵·독·석화 …)는 자동이라 새로 만든 상태에만 준다.
- 빛·불·번개 마법 이펙트 upsert_battle_animation blendMode:"add" — 배틀러·배경이 함께 밝아진다. 어둠·저주는 "multiply".
- 게임 전체를 옛 TV 로 set_project_settings displayFilter:"scanlines"(가로줄) | "crt"(가로줄+색 결+가장자리 어둡게).
`;

const readDirectingGuide: ToolDefinition = {
  name: "read_directing_guide",
  description:
    "컷신 연출 지침을 읽는다: 장면별 비트 조합 레시피(놀람·폭발·지진·기절·유령·순간이동·마법·회상·수중·빛기둥), 오래 남는 효과를 되돌리는 법, " +
    "레터박스·파티클·모습 효과(포즈·색·잔상)·감정 말풍선·화면 왜곡·겹치기·카메라 곡선의 쓰임, 컷신 밖 이벤트 명령 id 와 필드, " +
    "전투 연출(적 쓰러짐 collapseEffect·전투 배경 겹 backdropLayers·상태 오라 battleAura·이펙트 겹치기·화면 필터). " +
    "크로노 트리거·FF6 풍의 연출이 필요한 컷신을 쓰기 전에 한 번 읽는다(고정 텍스트라 반복 호출하지 않는다).",
  mode: "read",
  parameters: { type: "object", properties: {} },
  run(): ToolExecResult {
    return { summary: "컷신 연출 지침", data: { guide: DIRECTING_GUIDE } };
  },
};

export const DIRECTING_GUIDE_TOOLS: readonly ToolDefinition[] = [readDirectingGuide];
