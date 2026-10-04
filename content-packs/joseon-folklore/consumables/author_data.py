#!/usr/bin/env python3
"""Author only this role's full data/design; never edits shared IDs or a project DB."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
IDS = json.loads((ROOT.parent / "ids.json").read_text())

# slug, name, price, HP flat, MP flat, HP%, MP%, cures, occasion, levels, region, shop, flavour, icon intent
MEDICINES = [
    ("mugwort-pill", "쑥단", 16, 50, 0, 0, 0, [], "always", [1,20], "시작 마을·들길", "마을 약방", "말린 쑥을 꿀에 개어 빚은 초록 약환.", "쑥잎·초록 약환 두 알·벌어진 황갈색 종이 포장"),
    ("ginseng-tea", "산삼탕", 32, 0, 16, 0, 0, [], "always", [1,20], "시작 마을·산자락", "마을 약방", "작은 사발에 담은 산삼 달임물.", "청자 사발·호박색 탕·갈라진 뿌리·김"),
    ("purification-charm", "정화부", 18, 0, 0, 0, 0, ["state_poison"], "always", [1,20], "시작 마을·오래된 사당", "마을 부적 행상", "물결 모양 주사가 찍힌 황지 부적.", "세로 황지·접힌 모서리·붉은 추상 물결"),
    ("revival-charm", "환생부", 96, 1, 0, 25, 0, [], "field", [1,20], "시작 마을·산신당", "산신당 부적 장인", "붉은 끈과 금빛 혼불을 품은 접힌 부적.", "넓게 접은 부적·붉은 묶음끈·금빛 매듭·혼불"),
    ("rice-ball", "주먹밥", 12, 35, 0, 0, 0, [], "field", [1,5], "시작 마을·논두렁", "주막 밥상", "잎사귀에 올린 삼각 주먹밥.", "삼각 흰 쌀밥·짙은 김띠·바닥 잎사귀"),
    ("rice-cake", "시루떡", 30, 80, 0, 0, 0, [], "always", [5,10], "장터·고갯길", "장터 떡집", "팥고물을 끼워 쌓은 두툼한 시루떡.", "엇갈린 흰 떡 두 층·자주색 팥고물·나무 받침"),
    ("honey-cake", "꿀약과", 36, 35, 8, 0, 0, [], "always", [3,8], "장터·산길", "장터 떡집", "꽃무늬 틀에 눌러 꿀을 먹인 약과.", "꽃 모양 갈색 약과·방사형 홈·작은 꿀방울"),
    ("herbal-decoction", "약초탕", 56, 140, 0, 0, 0, [], "always", [8,15], "산길·약초꾼 오두막", "산길 약초꾼", "귀 달린 옹기 주전자에 넣은 진한 약초탕.", "짙은 옹기 손잡이·주둥이·잎 봉인·김"),
    ("red-ginseng", "홍삼", 84, 0, 40, 0, 0, [], "always", [8,15], "산자락·큰 장터", "큰 장터 약방", "말리고 쪄서 붉어진 산삼 뿌리.", "붉은 몸통·가지 뿌리·황금 묶음띠"),
    ("spring-water", "샘물", 25, 0, 12, 0, 0, [], "field", [1,5], "마을 샘·산자락", "샘터 행상", "짧은 대통에 담은 맑은 샘물.", "세로 대통·잘린 푸른 수면·흘러나온 물방울"),
    ("jade-water", "옥수", 72, 0, 8, 0, 25, [], "always", [10,20], "산신당·옥빛 동굴", "산신당 부적 장인", "옥마개를 씌운 납작한 물병.", "납작한 청록 물병·비대칭 옥마개·물빛 하이라이트"),
    ("antidote", "해독초", 24, 15, 0, 0, 0, ["state_poison"], "always", [1,8], "들길·약초밭", "마을 약방", "흰 뿌리가 남은 해독초 한 묶음.", "묶인 긴 잎 세 장·가는 흰 뿌리·빨간 끈"),
    ("clear-mind-pill", "청심단", 28, 0, 0, 0, 0, ["state_sleep","state_silence"], "always", [3,12], "장터·폐가", "장터 약방", "푸른 약갑에 담은 검푸른 약환.", "열린 푸른 사각 약갑·어두운 환·은빛 봉인"),
    ("warming-tea", "온기차", 26, 40, 0, 0, 0, ["state_paralysis"], "always", [3,12], "산길·고갯길", "고갯길 주막", "놋주전자에 달여 손발을 푸는 차.", "둥근 놋주전자·손잡이·붉은 김·짧은 주둥이"),
    ("cooling-tea", "청량차", 36, 0, 12, 0, 0, ["state_agility_down"], "always", [5,15], "대숲·여우 고개", "대숲 주막", "흰 찻잔에 띄운 푸른 잎차.", "높은 흰 찻잔·푸른 수면·민트잎·작은 받침"),
    ("vitality-tonic", "생기탕", 140, 50, 8, 25, 20, [], "always", [12,20], "산신당·깊은 산", "산신당 약초 장인", "붉은 끈으로 봉한 호리병의 생기탕.", "두 마디 호리병·붉은 봉인·금색 잎 표식"),
]
CURE_NAMES = {"state_poison":"독", "state_sleep":"수면", "state_silence":"침묵", "state_paralysis":"마비", "state_agility_down":"민첩 하락"}
SPECIALS = [
    ("smoke-powder", "연막가루", 24, 0, None, "anim_gen_smoke_vanish", [3,12], "장터·폐가", "장터 도구상", "매듭을 풀면 짙은 연기가 퍼지는 가루 주머니.", "기울어진 자주색 주머니·매듭·번지는 연기 군집"),
    ("fire-charm", "화염부", 32, 32, "fire", "anim_gen_fire_burst", [3,10], "장터·오래된 사당", "부적 행상", "불꽃 모양으로 탄 가장자리의 부적.", "불규칙한 탄 종이·붉은 불꽃·주황 불씨"),
    ("ice-charm", "빙결부", 32, 30, "ice", "anim_gen_ice_shatter", [3,10], "산신당·옥빛 동굴", "부적 행상", "횡으로 말아 푸른 결정으로 묶은 부적.", "가로 두루마리·청색 결정·양쪽 말린 끝"),
    ("thunder-charm", "뇌전부", 36, 34, "lightning", "anim_gen_thunder_strike", [5,12], "고갯길·대숲", "부적 행상", "번개처럼 꺾어 접은 부적.", "비틀린 세로 종이·금빛 번개·작은 방전 픽셀"),
]
# slug, name, buy-price metadata (base sale=half), enemy slug, drop%, levels, region, flavour, icon intent
MATERIALS = [
    ("rat-tail","들쥐 꼬리",4,"field-rat",45,[1,3],"들길·논두렁","들쥐의 가늘고 긴 꼬리.","분홍빛 S자 꼬리·짙은 갈색 털 뿌리"),
    ("boar-tusk","멧돼지 어금니",12,"wild-boar",35,[1,5],"들길·산기슭","휘어진 끝과 거친 뿌리가 남은 어금니.","휘어진 상아색 어금니·갈색 거친 뿌리"),
    ("bat-wing","박쥐 날개",8,"cave-bat",40,[2,6],"산자락 동굴","막과 가는 뼈가 남은 박쥐 날개.","삼각 자주색 날개막·밝은 뼈대·톱니 끝"),
    ("straw-knot","짚 매듭",6,"straw-dokkaebi",45,[1,5],"들길·폐가 주변","짚도깨비에서 풀려 나온 볏짚 고리.","투명한 고리 두 개·꼬인 볏짚·풀린 섬유"),
    ("ghost-ash","귀화재",10,"lantern-wisp",35,[4,8],"오래된 사당·묘역","꺼진 귀화가 남긴 창백한 재.","얕은 천 위 재 더미·작은 푸른 잔불·들린 재가루"),
    ("broken-jade","깨진 옥",16,"maiden-ghost",30,[5,10],"오래된 사당·옥빛 동굴","구멍 가장자리가 부러진 옥 조각.","뚫린 옥 고리의 파편·각진 깨짐·청록 절단면"),
    ("fox-fur","여우 털",20,"fox-spirit",30,[8,12],"여우 고개","흰 끝이 섞인 붉은 여우 털뭉치.","비대칭 주황 털 부채·흰 끝·따뜻한 음영"),
    ("stone-core","돌 심지",24,"stone-dokkaebi",30,[9,14],"깊은 동굴·돌길","돌도깨비 안에서 나온 거친 돌덩이.","각진 회색 광석·금빛 내부 균열·밑면 그림자"),
    ("bamboo-heart","대나무 심",18,"bamboo-specter",35,[9,14],"깊은 대숲","마디 사이에서 잘라 낸 단단한 대나무 심.","대각선 대나무 절편·빈 속·두 마디·짧은 가지"),
    ("rusted-token","녹슨 패",14,"masked-bandit",40,[7,12],"고갯길·산적 길목","한쪽이 이지러진 낡은 쇠패.","각진 쇠패·작은 구멍·녹 얼룩·짧은 끈"),
    ("bronze-shard","청동 조각",32,"bronze-dokkaebi",100,[12,16],"청동도깨비 굴","청동도깨비의 몸에서 떨어진 금속 조각.","톱니진 청동 판편·청록 녹·금속 절단면"),
    ("tiger-claw","호랑이 발톱",40,"mountain-tiger",100,[16,20],"깊은 산·산군의 바위","검은 끝과 굵은 밑동이 남은 발톱.","검은 끝의 굵은 발톱·백색 안쪽·짙은 털 밑동"),
]

def base(slug, name, price, kind, scope, occasion, consumable=True):
    return {"id":IDS["materials" if kind=="normalGoods" else "items"][slug], "name":name,
        "type":kind, "scope":scope, "price":price, "iconResourceId":f"jf-icon-{slug}", "imageResourceId":f"jf-icon-{slug}",
        "occasion":occasion, "occasionField":occasion in ("always","field"), "occasionBattle":occasion in ("always","battle"),
        "consumable":consumable, "consumptionLimit":"noLimit", "onlyUsableInMenu":occasion=="field",
        "onlyEffectiveOnDeadActors":slug=="revival-charm", "hpRecovery":{"flat":0,"percentMax":0},
        "mpRecovery":{"flat":0,"percentMax":0}, "healStateIds":[], "stateEffects":[], "usableActorIds":[], "usableClassIds":[]}

def amount(label, flat, percent):
    if percent: return f"{label}를 최대치의 {percent}%(내림)+{flat} 회복한다"
    return f"{label}를 {flat} 회복한다"

def design_entry(slug, record, levels, region, acquisition, icon):
    return {"id":record["id"], "slug":slug, "name":record["name"], "category":"material" if record["type"]=="normalGoods" else "consumable",
        "buyPrice":record["price"], "baseSellPrice":record["price"]//2, "recommendedLevels":levels, "region":region,
        "acquisitionStatus":"proposed-not-installed", "acquisition":acquisition, "iconDesign":icon,
        "actualEffect":{"scope":record["scope"], "occasion":record["occasion"], "hpFlat":record["hpRecovery"]["flat"],
        "hpPercentMax":record["hpRecovery"]["percentMax"], "mpFlat":record["mpRecovery"]["flat"], "mpPercentMax":record["mpRecovery"]["percentMax"],
        "cures":record["healStateIds"], "deadOnly":record["onlyEffectiveOnDeadActors"],
        "costPerSuccessfulUse":1 if record["consumable"] else 0}, "usageDescription":record["description"]}

def main():
    (ROOT/"status.json").write_text(json.dumps({"phase":"full","ready":False,"counts":{"consumables":20,"materials":12},"reason":"Full payload and review in progress"},indent=2)+"\n")
    items = {}; entries = {}; skills = []
    for slug,name,price,hp,mp,hpp,mpp,cures,occasion,levels,region,shop,flavour,icon in MEDICINES:
        r=base(slug,name,price,"medicine","ally",occasion)
        r.update(hpRecovery={"flat":hp,"percentMax":hpp},mpRecovery={"flat":mp,"percentMax":mpp},healStateIds=cures,
            stateEffects=[{"stateId":s,"operation":"remove","chance":100} for s in cures],
            animationId="anim_gen_psychic_wave" if (mp or mpp) and not (hp or hpp) else "anim_heal")
        if slug=="revival-charm":
            desc="필드 메뉴에서 전투불능 아군 한 명을 HP 최대치의 25%(내림)+1로 되살린다. 전투 중에는 사용할 수 없다."
        else:
            effects=[]
            if hp or hpp: effects.append(amount("HP",hp,hpp))
            if mp or mpp: effects.append(amount("기력(MP)",mp,mpp))
            if cures: effects.append("·".join(CURE_NAMES[s] for s in cures)+("를" if cures[-1]=="state_paralysis" else "을")+" 해제한다")
            desc="살아 있는 아군 한 명의 "+", ".join(effects)+"."
            if occasion=="field":desc+=" 필드 메뉴 전용이며 전투 중에는 사용할 수 없다."
        # Retain pilot IDs, names and numerical effects/prices.
        if slug=="purification-charm":desc="살아 있는 아군 한 명의 독을 해제한다. 맹독과 다른 상태는 해제하지 않는다."
        r["description"]=flavour+" "+desc
        acquisition=[{"kind":"shop","place":shop,"price":price},{"kind":"treasure","place":region+"의 보급함","quantity":1}]
        if slug=="revival-charm":acquisition[1]={"kind":"quest","place":"첫 도깨비 토벌 보상","quantity":1}
        d=design_entry(slug,r,levels,region,acquisition,icon)
        d["notes"]="회복은 최대치를 넘지 않는다. 지정한 상태만 해제하며 내성·면역이나 다른 상태 효과를 새로 부여하지 않는다."
        if slug=="revival-charm":
            d["examples"]=[{"maxHp":v,"beforeHp":0,"afterHp":min(v,v//4+1)} for v in (120,127,1)]
            d["notes"]="필드 메뉴에서만 부활. HP 외 MP·다른 상태는 보존한다. 전멸 구제·자동부활·전투중 부활 없음."
        if slug=="vitality-tonic":d["examples"]=[{"maxHp":120,"maxMp":36,"hpRecovery":80,"mpRecovery":15},{"maxHp":500,"maxMp":100,"hpRecovery":175,"mpRecovery":28}]
        if slug=="jade-water":d["examples"]=[{"maxMp":36,"mpRecovery":17},{"maxMp":100,"mpRecovery":33}]
        items[slug]=r; entries[slug]=d
    for slug,name,price,damage,element,animation,levels,region,shop,flavour,icon in SPECIALS:
        skill_id="skill_jf_item_"+slug.replace("-","_")
        r=base(slug,name,price,"special","enemy","battle")
        r.update(skillId=skill_id,activateSkillId=skill_id,animationId=animation)
        if element:
            effect_desc=f"전투에서 적 한 명에게 {dict(fire='불',ice='얼음',lightning='번개')[element]} 속성 기본 HP 피해 {damage}를 준다. 속성 상성·대상 상태에 따라 실제 피해가 달라진다. 기력 소모 없이 1개 소비한다. 필드 사용 불가."
        else:
            effect_desc="전투에서 적 한 명에게 기본 확률 100%로 민첩 하락을 건다(상태 저항 적용). 적용되면 민첩 계산 배율 0.5배. 피해·암흑·도주 보장은 없다. 기력 소모 없이 1개 소비한다. 필드 사용 불가."
        r["description"]=flavour+" "+effect_desc
        sk={"id":skill_id,"name":name+" 발동","description":effect_desc,"type":"normal","scope":"enemy","power":damage,
            "mpCost":{"flat":0,"percentMax":0},"successRate":100,"variance":0,"hitRate":100,"criticalRate":0,"animationId":animation,
            "effect":{"kind":"damage","statistic":"mind","affects":"hp"} if element else {"kind":"support"},
            "stateEffects":[] if element else [{"stateId":"state_agility_down","operation":"add","chance":100}]}
        if element:sk.update(elementId=IDS["elements"][element],damageFormula=str(damage))
        skills.append(sk)
        d=design_entry(slug,r,levels,region,[{"kind":"shop","place":shop,"price":price},{"kind":"treasure","place":region+"의 부적함","quantity":1}],icon)
        d["actualEffect"].update(skillId=skill_id,mpCost=0,baseDamage=damage,elementId=sk.get("elementId"),
            inflicts=sk["stateEffects"],variance=0,criticalRate=0,baseHitRate=100)
        d["notes"]="전용 아이템 기술이며 다른 담당의 직업24+적12 기술과 ID가 겹치지 않는다. 실패·상성 면역에도 승인된 전투 행동은 1개 소모한다."
        items[slug]=r;entries[slug]=d
    for slug,name,price,enemy,chance,levels,region,flavour,icon in MATERIALS:
        r=base(slug,name,price,"normalGoods","none","never",False)
        r["description"]=flavour+" 판매용 재료이며 직접 사용할 수 없다."
        d=design_entry(slug,r,levels,region,[{"kind":"enemyDrop","enemyId":IDS["enemies"][enemy],"chancePercent":chance,"quantity":1}],icon)
        d["notes"]="판매용 수집 재료. 상점 판매가는 기본 반값 기준이며 제작·교환·사용 효과는 미구현. 드롭 확률은 감독자 합의용 제안이고 여기서는 적 행동표/보상을 쓰지 않는다."
        items[slug]=r;entries[slug]=d
    order=[*IDS["items"],*IDS["materials"]]
    assert set(items)==set(order) and len(items)==32 and len(skills)==4
    assert all(sk["id"] not in [*sum(IDS["classSkills"].values(),[]),*IDS["enemySkills"].values()] for sk in skills)
    design={"packId":"joseon-folklore","role":"consumables","phase":"full","language":"ko",
        "world":"조선 설화에서 착안한 창작 오프라인 판타지", "fullTarget":{"consumables":20,"materials":12}, "delivered":{"consumables":20,"materials":12,"itemSkills":4},
        "deliveryScope":"자기 role의 실제 PNG·데이터·디자인·검토 근거. 획득·상점·드롭은 제안이며 실제 게임에 설치하지 않았다.",
        "economy":{"initialGold":80,"currencyLabel":"전","currencyStatus":"기획 표기; terms 변경은 감독자 담당",
            "sellPriceRule":"기본 판매가 floor(item.price/2); 프로젝트 판매표/흥정 설정은 감독자 통합 시 적용",
            "openingBasketExample":{"mugwortPills":3,"ginsengTeas":1,"totalPrice":80},
            "rationale":"쑥단 50HP/16전·산삼탕 16MP/32전 유지. 중급 HP80/30·HP140/56 및 MP40/84, 후반 비율회복은 소모품 투자 선택지. 재료 판매는 2~20전."},
        "engineContract":{"itemsInput":"data.json.items → normalizeItemRecord","skillsInput":"data.json.skills → normalizeSkillRecord; 공격부3+연막1의 skill_jf_item_*만 소유",
            "dependencies":"불·얼음·번개 속성은 ids.json에 예약된 element_jf_*를 skills 담당이 정의한다. 이 role은 states/elements를 저작하지 않는다. 모든 치료/연막 상태는 읽기전용 prototype에 존재한다.",
            "consume":"consumable=true + consumptionLimit=noLimit: 성공한 메뉴 사용 또는 승인된 전투 행동마다 1개; 무한재사용 아님",
            "menuNoEffect":"최대 회복/해제할 상태 없음/잘못된 생사 대상은 사용 거절하고 수량 유지",
            "battleNoEffect":"효과가 없거나 실패·속성면역이어도 승인된 전투 행동은 1개 소모할 수 있음",
            "recoveryFormula":"min(maxValue,before+floor(maxValue*percentMax/100)+flat)",
            "attackFormula":"damageFormula=32/30/34; variance=0, criticalRate=0, hitRate=100, mpCost=0; 속성·상태·기타 실제 엔진 보정은 적용",
            "smokeLimitation":"연막은 state_agility_down 기본100%(저항적용)·민첩배율0.5만 구현; 명중저하/암흑/확정도주 없음",
            "revivalLimitation":"itemAllowsBattle는 onlyEffectiveOnDeadActors 약품을 거절. 환생부는 occasion=field,occasionBattle=false; 전투부활/자동부활/전멸구제 없음",
            "deathRepresentation":"prototype에 state_death 없음; HP=0에 회복을 적용해 HP>0으로 부활. 없는 상태 참조를 넣지 않음",
            "classPermissions":"usableActorIds/usableClassIds=[]; 모든 직업 공통 사용; resource2 안 씀",
            "resourcePublication":"art-manifest.json의 assets/joseon-folklore/consumables/<slug>.png 경로는 감독자 public 등록용 계약; 이번 role은 자기 assets만 쓴다"},
        "entries":[entries[slug] for slug in order]}
    (ROOT/"data.json").write_text(json.dumps({"items":[items[slug] for slug in order],"skills":skills},ensure_ascii=False,indent=2)+"\n")
    (ROOT/"design.json").write_text(json.dumps(design,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"items":32,"consumables":20,"materials":12,"itemSkills":4}))

if __name__=="__main__":main()
