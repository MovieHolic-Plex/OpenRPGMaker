/** Real exported game. First run the canonical apply/export scripts. No editor shell. */
const key=(key,times=1)=>({kind:'key',key,times}),present=testid=>({kind:'waitFor',testid,state:'present',timeoutMs:30000}),until=(testid,state='absent')=>({kind:'pressUntil',key:'z',testid,state,maxPresses:24,timeoutMs:700}),ready={kind:'waitForFieldReady'};
const at=(mapId,x,y,dir='up')=>[ready,{kind:'teleport',mapId,x,y},{kind:'waitForPosition',mapId,x,y},ready,{kind:'face',dir}];
const scenario={projectFixture:'output/joseon-folklore/game.oprn.json',id:'joseon-folklore-full',viewport:{width:1100,height:760},beats:[
{id:'title',expect:{testidPresent:['title-screen']},shot:true},
{id:'village',ops:[key('Enter'),{kind:'waitForRuntime'},{kind:'seed',seed:17}],expect:{mapId:'joseon_v20',x:17,y:28,gold:80},shot:true},
{id:'jobs',ops:[...at('joseon_v20',17,27),{kind:'action'},present('dialogue-box'),until('runtime-choices','present')],expect:{visibleText:{'runtime-choices':'전사'}},shot:true},
{id:'promote-warrior',ops:[key('Enter'),present('dialogue-box'),until('dialogue-box'),ready],expect:{switches:{sw_class:true}}},
{id:'new-monsters',ops:[...at('joseon_field',48,24),{kind:'action'},present('dialogue-box'),until('battle-scene','present'),present('actor-command-attack'),{kind:'waitForAttr',testid:'battle-scene',attr:'data-battle-sequence-busy',value:'false'},{kind:'waitForAttr',testid:'battle-scenery',attr:'data-layers',value:'ready'}],expect:{battlerGeometry:{minEnemies:2}},shot:true},
{id:'job-skill',ops:[key('ArrowRight'),key('Enter'),present('actor-skill-skill_attack')],expect:{testidPresent:['actor-skill-skill_attack']},shot:true},
{id:'use-skill',ops:[key('ArrowDown'),key('Enter'),present('battle-target-prompt'),key('Enter')],expect:{testidPresent:['battle-scene']}},
{id:'win',ops:[present('actor-command-attack'),{kind:'waitForAttr',testid:'battle-scene',attr:'data-battle-sequence-busy',value:'false'},key('f'),{kind:'waitFor',testid:'battle-result-panel',state:'present',timeoutMs:120000}],expect:{testidPresent:['battle-result-panel']},shot:true},
{id:'new-shop',ops:[until('battle-scene'),ready,...at('joseon_v20',37,25,'left'),{kind:'action'},present('dialogue-box'),until('shop-scene','present'),key('Enter'),present('shop-buy-item_jf_mugwort_pill')],expect:{testidPresent:['shop-buy-item_jf_ginseng_tea']},shot:true},
]};
scenario.beats.push({id:'buy-medicine',ops:[{kind:'pointerClick',testid:'shop-buy-item_jf_mugwort_pill'},key('Enter')],expect:{inventory:{item_jf_mugwort_pill:6},gold:86},shot:true});
scenario.beats.push({id:'late-boss-choice',ops:[key('Escape'),key('Escape'),ready,...at('joseon_field',78,42),{kind:'action'},present('dialogue-box'),until('runtime-choices','present')],expect:{visibleText:{'runtime-choices':'산군'}},shot:true});
scenario.beats.push({id:'bride-wraith',ops:[key('Enter'),present('battle-scene'),present('actor-command-attack'),{kind:'waitForAttr',testid:'battle-scene',attr:'data-battle-sequence-busy',value:'false'}],expect:{battlerGeometry:{minEnemies:1}},shot:true});

export default scenario;
