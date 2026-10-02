import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Authored families, not placeholder numbered records. Effects use existing engine fields.
const records = [];
const assets = [];
const requests = [];
const totals = {};
const grades = ['맑은', '진한', '정제한', '숙성한', '농축한', '순수한', '비전의', '축복받은'];
const vessels = ['short round corked glass bottle', 'tall narrow glass vial', 'small ceramic flask', 'hexagonal glass bottle', 'wide glass ampoule', 'small metal-bound flask', 'faceted crystal bottle', 'ornate squat potion bottle'];

function add(group, slug, name, subject, properties) {
  const id = `item_shared_${group}_${slug}`;
  const resourceId = `oprn-item-${group}-${slug}`;
  records.push({ id, name, description: '', type: 'normalGoods', scope: 'none', price: 0,
    occasion: 'never', consumable: false, ...properties,
    iconResourceId: resourceId, imageResourceId: resourceId });
  assets.push({ id: resourceId, name, path: `assets/items/shared/${group}-${slug}.png`, imageWidth: 32, imageHeight: 32 });
  requests.push({ id: resourceId, name, path: `public/assets/items/shared/${group}-${slug}.png`, subject });
  totals[group] = (totals[group] ?? 0) + 1;
}
function medicine(description, price, effects, scope = 'ally') {
  return { type: 'medicine', scope, occasion: 'always', consumable: true, animationId: 'anim_heal', price, description, ...effects };
}
const hpHerbs = [['mugwort','쑥','sage green'],['rose','장미','rose red'],['ginseng','인삼','amber'],['aloe','알로에','pale green'],['hibiscus','히비스커스','deep crimson'],['camomile','카모마일','warm yellow'],['lotus','연꽃','pink'],['juniper','향나무','teal']];
for (const [family, label, color] of hpHerbs) for (let g=0;g<8;g++) {
  const hp = [40,75,120,180,260,380,550,800][g];
  add('healing',`${family}-${g+1}`,`${grades[g]} ${label} 회복액`,`${vessels[g]} containing ${color} medicinal liquid, a tiny ${label} leaf tied at its neck`,medicine(`${label}의 약효를 담았습니다. 아군 하나의 HP를 ${hp} 회복합니다.`,Math.round(hp*1.15+12),{ hpRecovery:{flat:hp,percentMax:0} }));
}
const manaBases = [['moon','월석','silver blue'],['azure','청금석','deep azure'],['violet','자수정','violet'],['dew','별이슬','cyan'],['cobalt','코발트','cobalt blue'],['lavender','라벤더','lavender purple']];
for (const [family,label,color] of manaBases) for(let g=0;g<8;g++) {
  const mp=[12,22,35,50,70,100,140,200][g];
  add('mana',`${family}-${g+1}`,`${grades[g]} ${label} 마력액`,`${vessels[g]} with ${color} liquid and a small plain silver neck fitting`,medicine(`마력을 머금은 ${label} 추출액입니다. 아군 하나의 MP를 ${mp} 회복합니다.`,mp*4+25,{mpRecovery:{flat:mp,percentMax:0},animationId:'anim_magic'}));
}
for(const [family,label,color] of [['dawn','새벽','orange pink'],['forest','숲숨','green blue'],['twilight','황혼','purple red'],['starlight','별빛','pale gold']]) for(let g=0;g<8;g++) {
  const hp=[30,55,90,130,190,270,390,560][g],mp=[8,14,22,32,46,65,90,130][g];
  add('elixir',`${family}-${g+1}`,`${grades[g]} ${label} 영약`,`${vessels[g]} of ${color} restorative elixir, plain bronze stopper`,medicine(`${label}의 기운을 보존한 영약입니다. 아군 하나의 HP를 ${hp}, MP를 ${mp} 회복합니다.`,hp+mp*4+35,{hpRecovery:{flat:hp,percentMax:0},mpRecovery:{flat:mp,percentMax:0}}));
}
const ailments=[['poison','해독','state_poison','독','green'],['sleep','각성','state_sleep','수면','yellow'],['paralysis','신경','state_paralysis','마비','orange'],['venom','정화','state_deep_poison','맹독','teal'],['silence','목소리','state_silence','침묵','blue'],['blind','시야','state_blind','암흑','violet'],['stop','시간','state_stop','스톱','silver'],['petrify','석화 해제','state_petrify','석화','gray']];
for(const [family,label,stateId,stateName,color] of ailments) for(let g=0;g<4;g++) {
  const hp=[0,30,65,110][g];
  add('remedy',`${family}-${g+1}`,`${grades[g]} ${label} 치료제`,`${vessels[g]} with ${color} remedy and a small unlettered cloth neck wrap`,medicine(`아군 하나의 ${stateName} 상태를 해제합니다.${hp ? ` HP도 ${hp} 회복합니다.` : ' 응급 처치를 위한 휴대용 약입니다.'}`,55+g*55,{healStateIds:[stateId],stateEffects:[{stateId,chance:100,operation:'remove'}],hpRecovery:{flat:hp,percentMax:0}}));
}
for(const [family,label,stateId,color] of [['valor','용맹','state_attack_up','red'],['bastion','철벽','state_defense_up','brown'],['haste','신속','state_agility_up','green'],['renewal','재생','state_regen','pink']]) for(let g=0;g<8;g++) {
  const hp=15+g*20;
  add('tonic',`${family}-${g+1}`,`${grades[g]} ${label} 강장제`,`${vessels[g]} of ${color} tonic with a plain bronze seal`,{...medicine(`전투 중 아군 하나에게 ${label==='용맹'?'공격 상승':label==='철벽'?'방어 상승':label==='신속'?'민첩 상승':'재생'} 상태를 부여하고 HP를 ${hp} 회복합니다.`,110+g*65,{stateEffects:[{stateId,chance:100,operation:'add'}],hpRecovery:{flat:hp,percentMax:0}}),occasion:'battle'});
}
for(const [family,label,color] of [['phoenix','불사조','red orange'],['dove','흰비둘기','ivory'],['crane','은학','silver'],['sunbird','태양새','gold']]) for(let g=0;g<4;g++) {
  const pct=[10,25,50,100][g];
  add('revival',`${family}-${g+1}`,`${grades[g]} ${label} 깃털`,`${color} revival feather with ${g+1} small barbs clusters, tied at its base with a plain thread`,{...medicine(`필드에서 전투 불능인 아군 하나를 최대 HP의 ${pct}%로 소생시킵니다. 살아 있는 대상에게는 사용할 수 없습니다.`,180+[0,150,420,900][g],{onlyEffectiveOnDeadActors:true,hpRecovery:{flat:0,percentMax:pct}}),occasion:'field'});
}
const foods=[['riceball','주먹밥','triangular rice ball wrapped with dark seaweed'],['bread','호밀빵','small brown rye loaf'],['sandwich','치즈 샌드위치','cheese sandwich with green lettuce'],['pie','사과 파이','golden apple pie wedge'],['stew','버섯 스튜','small clay bowl of brown mushroom stew'],['skewer','꼬치구이','grilled meat skewer'],['dumpling','고기만두','steamed meat dumpling'],['fish','생선구이','grilled silver fish'],['potato','구운 감자','brown baked potato with cream filling'],['salad','채소 샐러드','small bowl of leafy green salad'],['porridge','단호박 죽','clay bowl of orange pumpkin porridge'],['noodle','비빔국수','small bowl of red noodles'],['cookie','버터 쿠키','small golden butter cookie'],['cake','딸기 케이크','strawberry cake slice'],['soup','양파 수프','clay cup of golden onion soup'],['egg','허브 오믈렛','yellow herb omelette'],['jerky','훈제 육포','folded strips of dark smoked jerky'],['jam','산딸기 잼','short glass jar of red berry jam'],['cheese','숙성 치즈','yellow cheese wedge'],['tea','꿀차','small ceramic cup of amber honey tea']];
const foodGrades=['소박한','갓 만든','푸짐한','왕실'];
for(const [family,label,subject] of foods) for(let g=0;g<4;g++) {
  const n=foods.findIndex(x=>x[0]===family),hp=25+n*3+g*45,mp=(n%5)*3+g*6;
  add('food',`${family}-${g+1}`,`${foodGrades[g]} ${label}`,`${subject}; ${['simple rustic serving','fresh neatly prepared serving','generous serving with a modest garnish','carefully arranged fine serving with a tiny herb garnish'][g]}`,{...medicine(`여행 중 먹기 좋은 ${label}입니다. 아군 하나의 HP를 ${hp}${mp?`, MP를 ${mp}`:''} 회복합니다.`,Math.round(hp*.7+mp*2+10),{hpRecovery:{flat:hp,percentMax:0},mpRecovery:{flat:mp,percentMax:0}}),occasion:'field'});
}
for(const [family,parameter,label,form,color] of [['valor','attack','용맹','red berry','red'],['insight','mind','통찰','blue seed pod','blue'],['attack','attack','완력','amber nut','orange'],['defense','defense','인내','gray hard seed','gray'],['mind','mind','지혜','purple bean','purple'],['agility','agility','민첩','green winged seed','green']]) for(let g=0;g<8;g++) {
  const value=[1,1,2,2,3,4,5,7][g];
  const parameterName={attack:'공격',defense:'방어',mind:'정신',agility:'민첩'}[parameter];
  add('growth',`${family}-${g+1}`,`${grades[g]} ${label} 씨앗`,`${form} in a tiny ${['linen','leather','paper','woven leaf','velvet','cotton','silk','gold-trimmed cloth'][g]} seed pouch, ${color} main color`,{type:'seed',scope:'ally',occasion:'field',consumable:true,price:220+g*g*110,seedParameterBonuses:{[parameter]:value},description:`선택한 아군의 ${parameterName}을 영구적으로 ${value} 올립니다. ${label}의 기운이 응축된 희귀한 성장 씨앗입니다.`});
}
const books = [
  ['hero_cross_slash','십자베기'],['hero_rush_pierce','돌진 찌르기'],['hero_rising_blade','올려베기'],['hero_flame_sword','화염검'],['hero_whirlwind','회전베기'],['hero_war_cry','함성'],['hero_meteor_drop','낙하참'],['hero_brave_blade','브레이브 블레이드'],
  ['guard_shield_bash','방패 치기'],['guard_taunt','도발'],['guard_iron_wall','철벽'],['guard_counter','반격 태세'],['guard_charge','돌격'],['guard_holy_shield','성스러운 방패'],['guard_quake','지진 내려찍기'],['guard_fortress','요새'],
  ['mage_fireball','파이어볼'],['mage_magic_missile','매직 미사일'],['mage_blizzard','블리자드'],['mage_chain_lightning','연쇄 번개'],['mage_gravity','그라비티'],['mage_mana_shield','마나 실드'],['mage_meteor','메테오'],['mage_starfall','별빛 폭풍'],
  ['scout_twin_strike','쌍검 난무'],['scout_venom_blade','맹독 칼날'],['scout_shadow_step','그림자 습격'],['scout_smoke_bomb','연막탄'],['scout_steal','훔치기'],['scout_evasion','잔상 회피'],['scout_knife_storm','비수 폭풍'],['scout_assassinate','암살'],
  ['samurai_iai','발도술'],['samurai_twin_moon','쌍월참'],['samurai_wind_cut','풍절'],['samurai_mind_eye','심안'],['samurai_cherry','벚꽃 난무'],['samurai_thunder_draw','뇌광 일섬'],['samurai_blood_moon','혈월'],['samurai_final_cut','무명 일도'],
  ['priest_monk_chant','염불'],['priest_monk_staff_strike','석장 치기'],['priest_monk_vajra','금강신'],['priest_monk_bead_toss','염주 던지기'],['priest_monk_purify','정화'],['priest_monk_palm','장타'],['priest_monk_bell','범종'],['priest_monk_nirvana','열반'],
];
for(let i=0;i<books.length;i++) {
  const [skill,label]=books[i],color=['crimson','brown','navy blue','dark green','violet','ivory'][Math.floor(i/8)];
  add('manual',skill,`${label} 비전서`,`${color} closed skill manual with ${['crossed lines','small lance emblem','small rising chevron','tiny flame emblem','spiral emblem','small horn emblem','falling star emblem','plain diamond emblem'][i%8]} stamped in muted gold, ${i%2?'thin silver':'bronze'} corner fittings, no lettering`,{type:'book',scope:'ally',occasion:'field',consumable:true,price:350+(i%8)*180+Math.floor(i/8)*45,learnedSkillId:`skill_${skill}`,description:`선택한 아군에게 「${label}」 기술을 가르칩니다. 숙련자가 남긴 동작과 운용 요령을 정리한 비전서이며, 사용하면 소모됩니다.`});
}
const battleEffects=[['fire','화염','skill_fire','small red ceramic firebomb'],['ice','빙결','skill_ice','small blue frost crystal vial'],['thunder','뇌전','skill_thunder','yellow lightning stone'],['earth','암석','skill_earth','small gray stone bomb'],['wind','질풍','skill_wind','small folded green battle fan'],['dark','암흑','skill_dark','small purple cloth dust sachet']];
for(const [family,label,skillId,subject] of battleEffects) for(let g=0;g<8;g++) {
  add('battle',`${family}-${g+1}`,`${grades[g]} ${label} 투척물`,`${subject} with ${['linen','leather','copper','silver','bronze','dark iron','pale gold','polished brass'][g]} binding or cap`,{type:'special',scope:'enemy',occasion:'battle',consumable:true,consumptionLimit:[1,1,2,2,3,3,4,5][g],activateSkillId:skillId,price:120+g*90,description:`적 하나에게 「${label}」 기술을 발동합니다. 한 물건으로 ${[1,1,2,2,3,3,4,5][g]}회 사용할 수 있는 전투용 소모품입니다.`});
}
for(const [family,label,ballClass,color,base] of [['field','들판','poke','red',1],['river','강물','great','blue',1.35],['peak','산봉우리','ultra','gold',1.7],['forest','깊은 숲','ultra','green',1.6]]) for(let g=0;g<8;g++) {
  const multiplier=Number((base+g*.12).toFixed(2));
  add('capture',`${family}-${g+1}`,`${grades[g]} ${label} 포획구`,`${color} and cream spherical creature capture orb, plain bronze middle band, ${['round','square','diamond','crescent','leaf','star','chevron','sun'][g]} small abstract button, no franchise markings`,{type:'special',scope:'enemy',occasion:'battle',consumable:true,captureProfile:{multiplier,ballClass},price:85+Math.round(multiplier*100)+g*45,description:`약해진 몬스터를 포획하는 구슬입니다. 기본 포획률에 ${multiplier}배 보정을 적용하며, 사용하면 소모됩니다.`});
}
const careSubjects=[['oat','귀리','small bag of golden oat pellets'],['fish','생선','small pouch of dried fish flakes'],['beef','육포','small bundle of dried beef treats'],['berry','열매','small bag of red berry treats'],['milk','우유','small cream bottle of milk feed'],['nut','견과','small pouch of brown nuts'],['herb','허브','small bundle of green herb feed'],['honey','꿀','small jar of honey feed']];
for(const [family,label,subject] of careSubjects) for(let g=0;g<2;g++) {
  const friendshipDelta=8+g*7,expDelta=40+g*80;
  add('feed',`${family}-${g+1}`,`${g?'영양':'담백한'} ${label} 사료`,`${subject}, ${g?'a tidy red cloth tie':'a plain brown cloth tie'}`,{type:'special',scope:'none',occasion:'field',consumable:true,careProfile:{kind:'feed',friendshipDelta,expDelta},price:65+g*80,description:`파티 몬스터에게 먹여 친밀도를 ${friendshipDelta}, 경험치를 ${expDelta} 올립니다. ${label}의 향을 살린 휴대용 사료입니다.`});
}
for(const [i,label,subject] of [['ball','공','small stitched leather toy ball'],['rope','밧줄 장난감','small braided rope toy'],['bell','방울','small bronze toy bell'],['disc','원반','small wooden flying disc'],['mouse','쥐 인형','small gray cloth mouse toy'],['rattle','딸랑이','small wooden rattle'],['bone','장난감 뼈','small wooden toy bone'],['feather','깃털 막대','small feather toy on a short stick']]) for(let g=0;g<2;g++) {
  const friendshipDelta=10+g*10;
  add('toy',`${i}-${g+1}`,`${g?'튼튼한':'작은'} ${label}`,`${subject}, ${g?'reinforced with a colorful cloth strip':'simple rustic construction'}`,{type:'special',scope:'none',occasion:'field',consumable:true,careProfile:{kind:'toy',friendshipDelta},price:80+g*95,description:`파티 몬스터와 함께 놀아 친밀도를 ${friendshipDelta} 올립니다. 놀이를 마치면 소모됩니다.`});
}
const crops=[['wheat','밀 이삭','golden wheat stalks'],['rice','벼 이삭','pale rice stalks'],['corn','옥수수','yellow corn cob'],['bean','완두콩','green pea pod'],['carrot','당근','orange carrot'],['onion','양파','brown onion'],['turnip','순무','white and purple turnip'],['pumpkin','호박','small orange pumpkin'],['tomato','토마토','red tomato'],['pepper','고추','red pepper'],['eggplant','가지','purple eggplant'],['cabbage','양배추','green cabbage'],['grape','포도','purple grape cluster'],['pear','배','golden pear'],['peach','복숭아','pink peach'],['radish','무','white daikon radish']];
for(const [family,label,subject] of crops) for(let g=0;g<3;g++) {
  add('produce',`${family}-${g+1}`,`${['들판','잘 익은','특상품'][g]} ${label}`,`${subject}, ${['simple small harvested produce','ripe produce with a small leaf','plump premium produce with two small leaves'][g]}`,{price:25+g*45+crops.findIndex(x=>x[0]===family)*3,description:`농장에서 거둔 ${['소박한','알맞게 익은','품질 좋은'][g]} ${label}입니다. 식재료나 거래품으로 보관할 수 있습니다.`});
}
const materials=[['copper','구리','rough copper ore'],['silver','은','rough silver ore'],['gold','금','rough gold ore'],['iron','철','iron ingot'],['mithril','미스릴','pale blue mithril ingot'],['oak','참나무','short oak timber'],['pine','소나무','short pine timber'],['cloth','면직물','folded ivory cotton cloth'],['silk','비단','folded purple silk'],['leather','가죽','folded brown leather'],['bone','단단한 뼈','white sturdy bone'],['fang','송곳니','ivory curved fang'],['claw','발톱','dark curved claw'],['scale','비늘','teal scale'],['resin','수지','amber resin chunk'],['coal','석탄','black coal chunk'],['salt','암염','pale salt crystal'],['clay','점토','reddish clay lump'],['obsidian','흑요석','black glassy obsidian shard'],['quartz','수정','clear quartz crystal']];
for(const [family,label,subject] of materials) for(let g=0;g<4;g++) {
  add('material',`${family}-${g+1}`,`${['거친','선별한','정제한','장인의'][g]} ${label}`,`${subject}, ${['rough uneven silhouette','carefully selected clean silhouette','refined compact shape','high grade shape with one tiny tied cloth strip'][g]}`,{price:30+materials.findIndex(x=>x[0]===family)*8+g*g*70,description:`${['불순물이 남은','상태가 고른','깔끔하게 정제한','장인이 골라낸'][g]} ${label}입니다. 제작 소재나 거래품으로 보관할 수 있습니다.`});
}
const keys=[['harbor','항구','brass anchor-bow key'],['tower','탑','iron tower-shaped bow key'],['mine','광산','copper square-bow key'],['garden','정원','green leaf-bow key'],['library','서고','silver book-shaped bow key'],['cellar','지하실','rusty round-bow key'],['castle','성문','large plain iron key'],['shrine','사당','bronze bell-bow key'],['vault','금고','short gold key'],['observatory','관측소','silver star-bow key'],['mill','방앗간','brown wooden key token'],['workshop','공방','brass cog-bow key'],['canal','수로','blue metal key'],['crypt','묘실','gray stone key token'],['sanctum','성소','ivory carved key'],['treasury','보물고','gold sun-bow key']];
for(const [family,label,subject] of keys) for(let g=0;g<2;g++) {
  add('key',`${family}-${g+1}`,`${g?'봉인된':'낡은'} ${label} 열쇠`,`${subject} with ${g?'a tiny violet wax seal':'worn brown patina'}`,{price:0,description:`${label}의 문양이 새겨진 ${g?'봉인된':'오래된'} 열쇠입니다. ${g?'주인의 인장이 손잡이에 남아 있습니다.':'오랜 세월 손때가 묻어 있습니다.'}`});
}
for(const [tool,label,subject] of [['hoe','괭이','L-shaped farming hoe with a narrow bent neck and a broad flat rectangular digging blade at a right angle to the wooden shaft, never an axe or pickaxe'],['wateringCan','물뿌리개','small metal watering can'],['axe','도끼','short handled woodcutting axe'],['pickaxe','곡괭이','short handled mining pickaxe']]) for(let g=0;g<4;g++) {
  add('tool',`${tool}-${g+1}`,`${['나무','구리','철','강철'][g]} ${label}`,`${subject} made of ${['brown wood and gray stone','reddish orange copper with warm copper orange metal head and pale peach highlights, never gray metal','cool gray iron with dark gray metal head','pale silver steel with blue-gray metal head'][g]}, brown wooden handle`,{farmTool:tool,price:[70,180,390,740][g],description:`농사 작업에 쓰는 ${['입문용','튼튼한 구리제','실용적인 철제','견고한 강철제'][g]} ${label}입니다. 사용해도 소모되지 않습니다.`});
}
const baits=[['worm','지렁이','small curled red fishing worm'],['shrimp','새우','small pink shrimp'],['dough','떡밥','small golden dough bait ball'],['fly','깃털 미끼','small tied feather fishing lure'],['spinner','회전 미끼','small silver spinner lure'],['frog','개구리 미끼','small green wooden frog lure'],['minnow','작은 물고기','small silver minnow lure'],['spoon','금속 미끼','small gold spoon-shaped fishing lure']];
for(const [family,label,subject] of baits) for(let g=0;g<3;g++) add('fishing',`${family}-${g+1}`,`${['기본','정교한','명인의'][g]} ${label}`,`${subject}, ${['plain','a little blue thread wrap','a little red thread wrap'][g]}`,{price:20+g*45,description:`낚시꾼이 즐겨 보관하는 ${label}입니다. ${['단순한 형태','섬세한 마감','정성스러운 손질'][g]}이 특징인 낚시용 거래품입니다.`});
const gems=[['ruby','루비','red ruby'],['sapphire','사파이어','blue sapphire'],['emerald','에메랄드','green emerald'],['topaz','토파즈','golden topaz'],['amethyst','자수정','violet amethyst'],['opal','오팔','pale opal'],['garnet','석류석','dark red garnet'],['aquamarine','청옥','cyan aquamarine']];
for(const [family,label,subject] of gems) for(let g=0;g<4;g++) add('treasure',`${family}-${g+1}`,`${['원석','연마한','세공한','왕관급'][g]} ${label}`,`${subject} cut into a ${['rough natural lump','simple oval cabochon','small diamond facet shape','fine octagonal jewel'][g]}, no sparkle`,{price:160+g*g*240+gems.findIndex(x=>x[0]===family)*35,description:`${['자연 그대로의','표면을 매끈하게 다듬은','빛을 살려 세공한','색과 투명도가 뛰어난'][g]} ${label}입니다. 상인에게 판매할 수 있는 귀중품입니다.`});
for(const [family,label,subject] of [['wire','금속 철사','small coil of metal wire'],['buckle','버클','small square metal buckle'],['thread','실타래','small spool of blue thread'],['glue','접착제','small jar of amber glue'],['oil','윤활유','small brown oil bottle'],['hinge','경첩','small metal hinge'],['spring','용수철','small steel coil spring'],['gear','공방 톱니','small bronze cogwheel']]) for(let g=0;g<3;g++) add('component',`${family}-${g+1}`,`${['견습','숙련','정밀'][g]} ${label}`,`${subject}, ${['rough rustic construction','neat construction','polished precision construction'][g]}`,{price:45+g*85,description:`공방에서 쓰는 ${label}입니다. ${['간단한 작업','일반적인 제작','섬세한 제작'][g]}에 어울리는 가공 재료입니다.`});
for(const [family,label,color] of [['sun','태양','gold'],['moon','달','silver'],['tide','조수','blue'],['earth','대지','green']]) add('relay',family,`${label} 신호석`,`${color} small faceted relay stone in a plain bronze bracket`,{type:'switch',scope:'none',occasion:'field',consumable:true,switchId:`switch_shared_relay_${family}`,price:240,description:`사용하면 ${label} 기동 신호를 켭니다. 신호를 전달한 뒤 소모되는 장치용 돌입니다.`});

if(records.length!==772 || new Set(records.map(x=>x.id)).size!==772 || new Set(records.map(x=>x.name)).size!==772) throw new Error(`Invalid authored expansion: ${records.length} rows`);
for(const record of records) if(!record.description || !Number.isFinite(record.price)) throw new Error(`Incomplete item ${record.id}`);
async function json(relative,data) { const file=resolve(relative);await mkdir(dirname(file),{recursive:true});await writeFile(file,JSON.stringify(data,null,2)+'\n'); }
await json('src/project/defaults/sharedItemCatalog.json',records);
await json('src/assets/sharedItemIconAssets.json',assets);
const legacyRequests = JSON.parse(await readFile('assets/item-catalog/legacy-art-requests.json', 'utf8'));
await json('assets/item-catalog/art-requests.json',[...legacyRequests,...requests]);
await json('assets/item-catalog/catalog-summary.json',{version:1,baseItems:228,expandedItems:772,totalItems:1000,imageSize:32,categories:totals});
console.log(JSON.stringify({items:records.length,categories:totals,assets:assets.length}));
