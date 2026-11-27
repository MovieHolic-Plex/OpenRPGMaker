// 그림 동사 — generate_art(타이틀·엔딩·오프닝 키 CG) · draw_object(없는 기물 그리기 카드).
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import type { ImageReference } from "@/ai/imageReferences";
import { checkImageDataUrl } from "../../judge/imageCheck";
import type { ObjectSpec } from "../../shared/types";
import { drawObject } from "../../place/drawObject";
import { rememberObjectPlan, type DrawObjectResult } from "../../place/drawObject";
import { DUNGEON_PLACE_WORD, requestedDungeonSide } from "../../request/place";
import { POINT } from "../placeSchema";
import { text } from "../support";
import type { VerbContext } from "../context";

/** createV2Tools 에서 뗀 것 — generateArtVerb · drawObjectVerb. (artVerbs) */
export function artVerbs(c: VerbContext) {
  const { env, session, task, run, specGate, finishContent } = c;
  /**
   * generate_art — 타이틀·엔딩 그림을 이미지 모델로 만들어 건다(오너 2026-11-09: 맵 화면 그림은 생성이 안 될 때만 허용).
   * 생성기가 이 실행에 없거나 던지면 그 사실(오류)을 session.artAttempts 에 남기고 실패로 돌려준다 — 끝맺음 관문이 그 기록이 있으면 맵 화면 그림을 받아 준다.
   */
  const generateArtVerb: PiToolShape = {
    name: "generate_art", label: "타이틀·엔딩·오프닝 그림 만들기", concurrency: "exclusive",
    description: "Generate one 16:9 key-art illustration with the image model and register it as this game's title background, ending background, or opening scene CG (target:'opening' returns resourceId for compose_opening's key-cg/title-card shots). Pass style to match the game's genre, and pass referenceResourceId from the first shot to keep art style and palette consistent across multiple opening CGs. No text or letters in the picture.",
    parameters: { type: "object", properties: {
      target: { type: "string", enum: ["title", "ending", "opening"] },
      prompt: { type: "string", description: "the scene of THIS game's story, 1-2 sentences matching this game's exact genre and setting; no text, logos or borders" },
      style: { type: "string", description: "optional art direction / visual style matching this game's genre (e.g. 'rainy neo-noir anime cel art', 'warm Ghibli-like watercolor', 'gritty medieval dark fantasy oil illustration', 'retro 16-bit pixel art key visual')" },
      referenceResourceId: { type: "string", description: "optional resourceId of an earlier generated CG in this project to match its exact art style, line weight, lighting, and palette" },
      endingId: { type: "string", description: "ending target only: the ending id (default: every ending without its own picture)" },
    }, required: ["target", "prompt"] },
    async execute(_id, params, signal) {
      const p = params as { target?: string; prompt?: string; style?: string; referenceResourceId?: string; endingId?: string };
      const target: "title" | "ending" | "opening" = p.target === "ending" ? "ending" : p.target === "opening" ? "opening" : "title";
      const prompt = String(p.prompt ?? "").replace(/\s+/gu, " ").trim();
      const style = typeof p.style === "string" ? p.style.replace(/\s+/gu, " ").trim() : "";
      const refId = typeof p.referenceResourceId === "string" ? p.referenceResourceId.trim() : "";
      if (prompt.length < 8) return text({ ok: false, summary: "prompt must describe the scene in at least a sentence" });
      if (!env.generateImage) {
        session.artAttempts.set(target, { status: "unavailable", error: "image generation is not available in this run" });
        if (target === "opening") {
          return text({ ok: false, summary: "Picture generation is unavailable in this run — recorded. Finish the opening without generated CG using compose_opening (map-tour, mood title-card, or fitting landscape parallax) and/or author_opening_stage." });
        }
        return text({ ok: false, summary: `Picture generation is unavailable in this run — recorded. A map-view ${target} picture is then accepted; say in the final report that the picture could not be generated.` });
      }
      const referenceImages: ImageReference[] = [];
      if (refId) {
        const refAsset = env.ctx.project.assets.uploaded?.[refId];
        const m = refAsset?.dataUrl ? /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/u.exec(refAsset.dataUrl) : null;
        if (m) referenceImages.push({ mimeType: m[1] as ImageReference["mimeType"], data: m[2]! });
      }
      const styleLine = style ? `Visual style & art direction: ${JSON.stringify(style)}.` : "Visual style: cohesive, rich 2D game key-art illustration matching this specific genre and setting.";
      const continuityLine = referenceImages.length
        ? "Match the exact art style, brushwork, character/environment proportions, and color grading of the attached reference image, while depicting a NEW scene and camera angle described below."
        : "";
      const full = target === "opening"
        ? [
          "Create exactly one 16:9 cinematic key-art still for the opening sequence of a 2D game.",
          styleLine,
          ...(continuityLine ? [continuityLine] : []),
          `Scene (this game's own story): ${JSON.stringify(prompt)}.`,
          "Keep the lower 15% calm and uncluttered so a subtitle caption stays readable. Do not add any text, letters, logos, titles, watermarks, menus, buttons, borders or letterboxing.",
        ].join("\n\n")
        : [
          "Create exactly one 16:9 key-art background for the " + (target === "title" ? "title screen" : "ending screen") + " of a 2D game.",
          styleLine,
          ...(continuityLine ? [continuityLine] : []),
          `Scene (this game's own story): ${JSON.stringify(prompt)}.`,
          "Keep the left third calm so a menu or credits stay readable. Do not add any text, letters, logos, titles, watermarks, menus, buttons, borders or letterboxing.",
        ].join("\n\n");
      let image: Awaited<ReturnType<NonNullable<typeof env.generateImage>>>;
      try { image = await env.generateImage({ prompt: full, ...(referenceImages.length ? { referenceImages } : {}), ...(signal ? { signal } : {}) }); }
      catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const prior = session.artAttempts.get(target);
        // 한 번 성공한 그림은 뒤의 실패가 지우지 않는다(ok 가 이긴다). 일시 오류 한 번으로 문이 열리지 않게 같은 대상에서 두 번 실패해야 «실패 기록»이다.
        const failures = (prior?.failures ?? 0) + 1;
        if (prior?.status !== "ok") session.artAttempts.set(target, { status: "failed", error: message.slice(0, 300), failures });
        if (target === "opening") {
          return text({ ok: false, summary: `Opening CG generation failed (${failures}/2 recorded): ${message.slice(0, 200)}. Finish cleanly with compose_opening (map-tour / mood title-card / fitting parallax) and author_opening_stage without stalling.` });
        }
        return text({ ok: false, summary: `Picture generation failed (${failures}/2 recorded): ${message.slice(0, 200)}. Try again once with a different prompt; after two recorded failures a map-view ${target} picture is accepted — say so in the final report.` });
      }
      // 제공자가 돌려준 그림이 «끝까지 온 파일» 인지 본다 — 잘린 JPEG·깨진 base64 를 등록하면 타이틀이 검은 칸인데 관문은 그림이 있다고 본다(리드 2026-11-09).
      const decodable = checkImageDataUrl(image.dataUrl);
      if (!decodable.ok) {
        const prior = session.artAttempts.get(target);
        const failures = (prior?.failures ?? 0) + 1;
        if (prior?.status !== "ok") session.artAttempts.set(target, { status: "failed", error: `undecodable image: ${decodable.reason}`.slice(0, 300), failures });
        if (target === "opening") {
          return text({ ok: false, summary: `The generated opening CG is not a valid image (${decodable.reason}) — it was NOT registered. Fall back to compose_opening (map-tour / mood title-card) and author_opening_stage.` });
        }
        return text({ ok: false, summary: `The generated picture is not a valid image (${decodable.reason}) — it was NOT registered (${failures}/2 recorded). Try again once with a different prompt; after two recorded failures a map-view ${target} picture is accepted — say so in the final report.` });
      }
      const resourceId = `gen-${target}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const label = target === "title" ? "Title" : target === "ending" ? "Ending" : "Opening";
      const reg = run.call("upsert_resource", { resource: { id: resourceId, name: `${label} art`, kind: target === "title" ? "title" : "backdrop", dataUrl: image.dataUrl } });
      if (!reg.ok) { session.artAttempts.set(target, { status: "failed", error: String(reg.summary).slice(0, 300) }); return text({ ok: false, summary: `The picture was made but could not be registered: ${reg.summary}` }); }
      if (target === "title") {
        const set = run.call("set_title_screen", { backgroundResourceId: resourceId, backgroundFit: "cover", backgroundRendering: "smooth" });
        if (!set.ok) return text({ ok: false, summary: `The title picture was registered but not set: ${set.summary}` });
      } else if (target === "ending") {
        const wanted = p.endingId ? [p.endingId] : (env.ctx.project.endings ?? []).map((e) => e.id);
        if (!wanted.length) return text({ ok: false, summary: "No ending is defined yet — define the ending first (define_ending), then generate its picture." });
        for (const eid of wanted) {
          const ending = (env.ctx.project.endings ?? []).find((e) => e.id === eid);
          if (!ending) return text({ ok: false, summary: `No ending ${eid}` });
          const wrote = run.call("define_ending", { id: ending.id, name: ending.name, presentation: { ...(ending.presentation ?? {}), backgroundResourceId: resourceId } });
          if (!wrote.ok) return text({ ok: false, summary: `Could not set the ending picture: ${wrote.summary}` });
        }
      }
      session.artAttempts.set(target, { status: "ok" });
      await env.checkpoint("generate_art");
      if (target === "opening") {
        return text({ ok: true, summary: `Opening key-art CG generated (${image.provider} ${image.model}) and registered as ${resourceId}. Attach it in compose_opening via { template:'key-cg', resourceId:'${resourceId}' } or { template:'title-card', resourceId:'${resourceId}' }. Pass referenceResourceId:'${resourceId}' on next generate_art{target:'opening'} calls to keep the exact same art style and palette.`, data: { resourceId } });
      }
      return text({ ok: true, summary: `The ${target} picture is generated (${image.provider} ${image.model}) and set (${resourceId}).`, data: { resourceId } });
    },
  };
  const drawObjectVerb: PiToolShape = {
    name: "draw_object", label: "없는 물건 그리기", concurrency: "exclusive",
    description: "Hand an object the chipset lacks to the workshop one-click drawing path. The result summary honestly says whether it was placed or is pending.",
    parameters: { type: "object", properties: { object: { type: "object", properties: {
      what: { type: "string" }, description: { type: "string" }, mapId: { type: "string" }, where: { type: "string" }, at: POINT,
      notThese: { type: "array", items: { type: "string" }, description: "ids that were rejected as «already exists» but whose art is a different object from the request" },
    }, required: ["what"] } }, required: ["object"] },
    async execute(id, params) {
      const drawSpecFirst = specGate("draw_object", "draw_object");
      if (drawSpecFirst) return drawSpecFirst;
      const object = (params as { object: ObjectSpec }).object;
      // 동굴·던전 입구는 물건이 아니라 들어가는 장소다 — 그림 카드로 미루면 맵에 아무것도 서지 않고 들어갈 곳도 없다(2026-10-30 실조수 opus 「서쪽 길 끝 동굴」).
      // 이 실행에 던전을 아직 짓지 않았으면 그리지 않고 make_place 로 돌려보낸다. 지은 뒤 입구 꾸밈을 더 그리는 것은 막지 않는다.
      if (DUNGEON_PLACE_WORD.test(`${object.what ?? ""} ${object.description ?? ""}`) && ![...session.places.values()].some((r) => r.builder === "dungeon")) {
        const side = requestedDungeonSide(String(task ?? ""));
        return text({ ok: false, notFailure: true, summary: `그리지 않았다(실패 아님) — 「${object.what}」은 그림 한 장이 아니라 들어가는 장소다. make_place type "cave"(또는 "dungeon")로 굴을 지으면 짓기가 지금 마을${side ? `의 ${({ north: "북", south: "남", east: "동", west: "서" } as const)[side]}쪽` : ""} 가장자리 길 끝 칸에 바깥 문(입구)을 잇는다. 굴을 지은 뒤에도 입구 꾸밈이 더 필요하면 그때 draw_object 를 부른다.` });
      }
      const result: DrawObjectResult = drawObject(run, { ...object, ...(object.mapId || !env.ctx.currentMapId ? {} : { mapId: env.ctx.currentMapId }) });
      // 미리 정한 자리·크기를 기억한다 — 그림이 끝난 뒤 place_object 가 where·at 없이 불리면 이 자리에 놓는다.
      if (result.ok && result.plan) rememberObjectPlan(session, result.plan);
      return finishContent(id, "draw_object", params, result);
    },
  };
  return { generateArtVerb, drawObjectVerb };
}
