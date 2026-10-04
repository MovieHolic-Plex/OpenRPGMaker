import data from './projectInterviewScenes.json';

export const INTERVIEW_SCENE_STYLE_VERSION = 2;
/** Small deterministic freshness marker; SHA-256 receipts remain the publication authority. */
export const INTERVIEW_SCENE_CATALOG_SIGNATURE = (() => {
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify(data)) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, '0');
})();
export const INTERVIEW_SCENE_SLOTS = ['experience', 'activity', 'detail', 'progression', 'scope'] as const;
export type InterviewSceneSpec = {
  key: string; parent: string | null; genre: string | null; depth: number;
  choices: string[]; facts: string[]; children: string[]; prompt: string;
};
export const interviewSceneKey = (genre: string, choices: readonly string[]) => [genre, ...choices].join('--');

const style = `Use case: stylized-concept. Asset type: ONE game-maker interview background, not gameplay or a spritesheet.
OUTPUT: ONE 16:9 landscape scene. File dimensions are unrestricted: do NOT force 320x180 or a physical file color count. Construct the art as magnified 1990s 16-bit RPG pixel scenery, never a realistic painting with pixel texture.
STYLE LOCK: coarse visibly square pixel clusters at normal viewing size, deliberate stair-step contours and flat 2–4-step shade ramps. One coherent visible pixel grid across sky, water, architecture, foliage and foreground shadows. Sparse patterned dithering, no dense stippled texture. Use a restrained coherent palette as art direction. Rich foreground, readable midground, distant silhouettes. Composition focal point on the left 60%; quieter fully drawn right 35% behind interview controls. Edge-to-edge continuous artwork.
REFERENCE POLICY: supplied images are pixel-craft STYLE references only. Copy square cluster scale and hard-edged shading, NEVER their scene, objects, bridge, river, castle, camera, composition or palette. Every scene must be independently composed for its actual choices.
FORBIDDEN: smooth gradients, antialiasing, brush texture, painterly scenery, photographic detail, bloom, blur, 3D, vector art, UI, text, signs, readable writing, logos, frames, collage, reused composition. No humans or humanoids: the user has not selected a protagonist's appearance. Do not invent their identity, outfit, gender or profession.
Each prefix gets an independent cinematic shot. Reflect ALL facts below without contradicting earlier answers. Change location framing, foreground motif and focal object to visibly emphasize the latest choice; do not copy a previous scene or only recolor it. Structure and scope choices are represented by environment staging, never menu graphics. Unchosen answers must not appear as established story facts.`;

export function createInterviewScenePlan(): InterviewSceneSpec[] {
  const root: InterviewSceneSpec = { key: 'opening', parent: null, genre: null, depth: 0, choices: [], facts: [], children: data.genres.map(g => g.id), prompt: `${style}\nINITIAL SCENE: an inviting river valley, a small bridge joining two quiet shores, distant hills and warm windows. No genre or protagonist has been chosen.` };
  const scenes = [root];
  for (const genre of data.genres) {
    const visit = (choices: string[], facts: string[], parent: string) => {
      const key = interviewSceneKey(genre.id, choices);
      const depth = choices.length;
      const next = genre.questions[depth];
      scenes.push({ key, parent, genre: genre.id, depth, choices, facts,
        children: next?.options.map(o => interviewSceneKey(genre.id, [...choices, o.id])) ?? [],
        prompt: `${style}\nGENRE: ${genre.label} — ${genre.description}\nSELECTED FACTS:\n${facts.map((f, i) => `${i + 1}. ${f}`).join('\n') || 'No specific scenario chosen yet. Show an open-ended establishing environment for this genre.'}\nLATEST CHOICE: ${facts.at(-1) ?? genre.label}\nSCENE ID: ${key}. This identifier is metadata; never draw it.`,
      });
      if (next) for (const option of next.options) visit([...choices, option.id], [...facts, `${next.label}: ${option.label} — ${option.detail}`], key);
    };
    visit([], [], 'opening');
  }
  return scenes;
}
