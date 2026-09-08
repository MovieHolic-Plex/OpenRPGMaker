import assert from "node:assert/strict";
import { prerequisiteFixture, page } from "../../../test/npcPrerequisiteFixture.ts";
import { verifyNpcRewardsPlayable } from "../../../src/ai/workItemOutcome.ts";
import { AssistantSession, type SessionEvent } from "../../../src/ai/assistantSession.ts";
import { defaultAiConfig } from "../../../src/ai/llmClient.ts";
import { fixedDeclarer } from "../../../test/intentFixture.ts";
globalThis.fetch = (() => { throw new Error("Unexpected network"); }) as typeof fetch;
function fixture(earlyAmount = 20) {
  const f = prerequisiteFixture();
  f.prelude.splice(0);
  f.chief.pages = [
    page("touch", [{kind:"changeGold",op:"+=",amount:earlyAmount},{kind:"setSwitch",switchId:"accepted",value:true}], [], {kind:"playerTouch"}, false),
    page("claim", [{kind:"changeGold",op:"+=",amount:20},{kind:"setSwitch",switchId:"paid",value:true}], [{kind:"switch",switchId:"accepted",value:true}], {kind:"action"}, false),
    page("claimed", [], [{kind:"switch",switchId:"paid",value:true}], {kind:"action"}, false),
  ];
  for (const p of f.chief.pages) p.footprint = {width:3,height:1};
  return f;
}
function run(f: ReturnType<typeof fixture>) {
  const before = structuredClone(f.project);
  const result = verifyNpcRewardsPlayable(f.project,[f.requirement],new Map([[f.requirement,f.witness]]));
  assert.deepEqual(f.project,before);
  return result;
}
const implicit = run(fixture());
const explicitFixture = fixture();
explicitFixture.prelude.push({kind:"walk",mapId:explicitFixture.village.id,to:{x:5,y:2},adjacent:true});
const explicit = run(explicitFixture);
const noEarly = run(fixture(0));
console.log(JSON.stringify({implicitHostApproach:implicit,identicalApproachExplicitPrelude:explicit,noEarlyPaymentControl:noEarly},null,2));
assert.equal(implicit.ok,false);
assert.equal(implicit.evidence![0]!.final.gold,57);
assert.equal(implicit.evidence![0]!.claim,undefined);
assert.equal(explicit.ok,false);
assert.equal(noEarly.ok,true);
assert.equal(noEarly.evidence![0]!.final.gold,57);
// Native session tool dispatch and final completion, with deterministic local providers only.
const f = fixture();
const before = structuredClone(f.project);
const events: SessionEvent[] = [];
let callSent = false;
const session = new AssistantSession(f.project, {
  config: {...defaultAiConfig(),agentMode:"chat",model:"test",liteModel:"test",apiKey:"test",maxToolCalls:12,maxTokens:32000},
  declareIntent: fixedDeclarer({mode:"modify",npcRewards:[f.requirement]}),
  chat: async () => {
    if (!callSent) {
      callSent = true;
      return {message:{role:"assistant",content:null,tool_calls:[{id:"approach",type:"function",function:{name:"verify_npc_reward",arguments:JSON.stringify({requirementIndex:0,prelude:[]})}}]},finishReason:"tool_calls"};
    }
    return {message:{role:"assistant",content:"APPROACH_CHARACTERIZATION_COMPLETE"},finishReason:"stop"};
  },
});
const result = await session.sendUserMessage("Verify exactly 20 currency from the chief once", event => events.push(event));
const proof = events.find(event=>event.type==="tool_call"&&event.name==="verify_npc_reward");
assert.ok(proof?.type==="tool_call");
assert.equal(proof.result.ok,false);
assert.ok(!result.assistantText.includes("APPROACH_CHARACTERIZATION_COMPLETE"));
assert.deepEqual(f.project,before);
console.log(JSON.stringify({nativeSessionProof:proof.result.data,finalCompletionAccepted:false,sourceProjectUnchanged:true},null,2));
