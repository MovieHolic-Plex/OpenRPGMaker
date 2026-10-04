/** @type {import("../../lib/runtimeQa.d.mts").RuntimeQaScenario} */
export default {
  id:"worldmap-selected",
  beats:[
    {id:"title",note:"SQLite에서 재로드한 선택 아이콘 도감",expect:{testidPresent:["title-screen"]}},
    {id:"grafted-icons",note:"기존 EasyRPG 지형 위에 이식한 선택 수도 2종·75% 캐릭터",ops:[{kind:"key",key:"Enter"},{kind:"waitForRuntime"},
      {kind:"waitForAttr",testid:"runtime-state-json",attr:"data-live-flags",value:"wmi_graft|7|10|true|false"}],
      expect:{mapId:"wmi_graft",x:7,y:10,playerSpriteTextureLoaded:true,testidAbsent:["title-screen"]},shot:true},
    {id:"walk-entrance",note:"아이콘 밑줄 중앙 입구를 걸어서 통과",ops:[{kind:"key",key:"ArrowUp"},{kind:"waitForPosition",mapId:"wmi_graft",x:7,y:9}],
      expect:{mapId:"wmi_graft",x:7,y:9},shot:true},
    {id:"blocked-wall",note:"입구 옆 건물 밑줄은 막힘",ops:[{kind:"hold",dir:"left",ms:500}],expect:{mapId:"wmi_graft",x:7,y:9}},
  ],
};
