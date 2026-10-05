// Actual saved adversarial fixtures, rendered through the export player shim.
export default {
 id:'worldmap-autotile-visual',
 beats:[
  {id:'title',note:'정본을 내보낸 플레이어의 타이틀',expect:{testidPresent:['title-screen']}},
  {id:'coast',note:'해안·오목 만·1칸 지협',ops:[{kind:'key',key:'Enter'},{kind:'waitForRuntime'}],expect:{mapId:'qa_coast',x:12,y:3,playerSpriteTextureLoaded:true},shot:true},
  {id:'bridge-bank',note:'가로 다리 왼쪽 강둑',ops:[{kind:'teleport',mapId:'qa_water',x:4,y:10},{kind:'waitForPosition',mapId:'qa_water',x:4,y:10}],expect:{mapId:'qa_water',x:4,y:10,playerSpriteTextureLoaded:true},shot:true},
  {id:'bridge-deck',note:'실제 입력으로 다리 위에 진입',ops:[{kind:'key',key:'ArrowRight',holdMs:80},{kind:'waitForPosition',mapId:'qa_water',x:5,y:10,timeoutMs:4000}],expect:{mapId:'qa_water',x:5,y:10},shot:true},
  {id:'bridge-water-blocked',note:'다리에서 위쪽 물 칸으로 빠지지 않는다',ops:[{kind:'hold',dir:'up',ms:450}],expect:{mapId:'qa_water',x:5,y:10}},
  {id:'bridge-exit',note:'다리 반대편으로 건넌다',ops:[{kind:'key',key:'ArrowRight',holdMs:80},{kind:'waitForPosition',mapId:'qa_water',x:6,y:10,timeoutMs:4000}],expect:{mapId:'qa_water',x:6,y:10},shot:true},
  {id:'vertical-bank',note:'세로 다리 위쪽 강둑',ops:[{kind:'teleport',mapId:'qa_water',x:17,y:5},{kind:'waitForPosition',mapId:'qa_water',x:17,y:5}],expect:{mapId:'qa_water',x:17,y:5}},
  {id:'vertical-deck',note:'세로 다리 위로 실제 방향키 진입',ops:[{kind:'key',key:'ArrowDown',holdMs:80},{kind:'waitForPosition',mapId:'qa_water',x:17,y:6,timeoutMs:4000}],expect:{mapId:'qa_water',x:17,y:6},shot:true},
  {id:'vertical-water-blocked',note:'세로 다리에서 왼쪽 물 칸으로 빠지지 않는다',ops:[{kind:'hold',dir:'left',ms:450}],expect:{mapId:'qa_water',x:17,y:6}},
  {id:'vertical-exit',note:'세로 다리 반대편으로 건넌다',ops:[{kind:'key',key:'ArrowDown',holdMs:80},{kind:'waitForPosition',mapId:'qa_water',x:17,y:7,timeoutMs:4000}],expect:{mapId:'qa_water',x:17,y:7},shot:true},
  {id:'forest',note:'숲·산의 구멍과 서로 다른 바닥',ops:[{kind:'teleport',mapId:'qa_forest',x:18,y:10},{kind:'waitForPosition',mapId:'qa_forest',x:18,y:10}],expect:{mapId:'qa_forest',x:18,y:10,playerSpriteTextureLoaded:true},shot:true}
 ]
};
