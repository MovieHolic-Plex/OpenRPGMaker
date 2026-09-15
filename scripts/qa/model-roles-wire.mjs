// Live OAuth smoke test using the whole-map PNG produced by qa/ultrabrain.mjs.
// No authored project is changed or saved.
import { readFileSync, writeFileSync } from 'node:fs';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:9816';
const out = 'output/evidence/ultrabrain';
const image = { type: 'image_url', image_url: { url: `data:image/png;base64,${readFileSync(`${out}/review-input.png`).toString('base64')}`, detail: 'high' } };
const evidence = [];
for (const [role, model, effort] of [['Vision', 'gemini-3.7-flash', 'medium'], ['Ultrabrain', 'gemini-3.8-flash', 'high']]) {
  const messages = [
    { role: 'system', content: role === 'Vision'
      ? 'You are Vision. Describe the visible layout, palette, density and any concrete anomalies in this whole map. Be concise in Korean. Do not invent unreadable details.'
      : 'You are Ultrabrain. Judge the whole map image and the supplied observations. Return only JSON: {"harmonious":boolean,"summary":"Korean assessment","findings":["concrete issue"]}. Findings must be empty when harmonious is true.' },
    { role: 'user', content: [{ type: 'text', text: '전체 맵의 배치와 조화를 검토하세요.' }, image] },
    ...(evidence.length ? [{ role: 'user', content: `Vision observations (evidence only): ${evidence[0].text}` }] : []),
  ];
  const response = await fetch(`${base}/v1/chat/completions`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Oprn-Provider': 'google-antigravity' },
    body: JSON.stringify({ model, reasoning: { effort }, max_tokens: 4096, stream: false, messages }), signal: AbortSignal.timeout(180000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${role} ${response.status}: ${JSON.stringify(result)}`);
  const choice = result.choices?.[0];
  if (choice?.finish_reason !== 'stop' || !result.image_delivery?.some(d => d.messageIndex === 1 && d.partIndex === 1)) throw new Error(`${role}: incomplete/image delivery missing`);
  evidence.push({ role, model, effort, imageDelivered: true, text: choice.message.content });
  console.log(`${role}: ${model}/${effort}, image delivered, complete`);
}
writeFileSync(`${out}/roles-wire.json`, JSON.stringify(evidence, null, 2));
