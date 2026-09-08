import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import * as piAi from "@oh-my-pi/pi-ai";
import * as catalog from "@oh-my-pi/pi-catalog";
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_PROVIDER_ID,
  generateProviderImage,
} from "../scripts/lib/ohMyPiImageRuntime.ts";

const originalStub = process.env.RPG_ZZU_OH_MY_PI_TEST_STUB;
const apiKey = JSON.stringify({ token: "test-image-access", projectId: "test-image-project" });
const base64 = "aW1hZ2U=";

function imageFetch(requests: unknown[]): typeof fetch {
  return mock(async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    const chunk = {
      response: {
        candidates: [{
          content: {
            role: "model",
            parts: [{ text: "done" }, { inlineData: { mimeType: "image/png", data: base64 } }],
          },
          finishReason: "STOP",
        }],
      },
    };
    const response = new Response(
      `data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream" } },
    );
    Object.defineProperty(response, "url", { value: String(input) });
    return response;
  });
}

describe("image model resolution", () => {
  beforeEach(() => { delete process.env.RPG_ZZU_OH_MY_PI_TEST_STUB; });
  afterEach(() => {
    mock.restore();
    if (originalStub === undefined) delete process.env.RPG_ZZU_OH_MY_PI_TEST_STUB;
    else process.env.RPG_ZZU_OH_MY_PI_TEST_STUB = originalStub;
  });

  test("rejects an unavailable explicit model before completion or transport", async () => {
    const requestedModel = "missing-image-model-for-resolution-test";
    expect(catalog.getBundledModel(IMAGE_PROVIDER_ID, requestedModel)).toBeUndefined();
    const completion = spyOn(piAi, "complete");
    const requests: unknown[] = [];

    const result = generateProviderImage(IMAGE_PROVIDER_ID, {
      model: requestedModel, prompt: "portrait",
    }, { apiKey, fetch: imageFetch(requests) });

    await expect(result).rejects.toMatchObject({ status: 400 });
    expect(completion).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });

  test.each([
    ["omitted", {}],
    ["blank", { model: "  " }],
    ["explicit", { model: `  ${DEFAULT_IMAGE_MODEL}  ` }],
  ])("uses the catalog image model for %s selection", async (_name, selection) => {
    const requests: unknown[] = [];
    const resolved = catalog.getBundledModel(IMAGE_PROVIDER_ID, DEFAULT_IMAGE_MODEL);

    const image = await generateProviderImage(IMAGE_PROVIDER_ID, {
      ...selection, prompt: "portrait",
    }, { apiKey, fetch: imageFetch(requests) });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: resolved.id });
    expect(image).toEqual({ provider: IMAGE_PROVIDER_ID, model: resolved.id, mimeType: "image/png", base64 });
  });

  test("reports the resolved catalog ID rather than its lookup key", async () => {
    const resolved = catalog.getBundledModel(IMAGE_PROVIDER_ID, DEFAULT_IMAGE_MODEL);
    const lookup = spyOn(catalog, "getBundledModel").mockReturnValue(resolved);
    const requests: unknown[] = [];
    const lookupKey = "catalog-image-alias";

    const image = await generateProviderImage(IMAGE_PROVIDER_ID, {
      model: lookupKey, prompt: "portrait",
    }, { apiKey, fetch: imageFetch(requests) });

    expect(lookup).toHaveBeenCalledWith(IMAGE_PROVIDER_ID, lookupKey);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: resolved.id });
    expect(image.model).toBe(resolved.id);
  });

  test("keeps stub selection independent of the catalog and completion", async () => {
    process.env.RPG_ZZU_OH_MY_PI_TEST_STUB = "1";
    const completion = spyOn(piAi, "complete");
    const lookup = spyOn(catalog, "getBundledModel");
    const requests: unknown[] = [];

    const explicit = await generateProviderImage(IMAGE_PROVIDER_ID, {
      model: "stub-only-model", prompt: "portrait",
    }, { fetch: imageFetch(requests) });
    const omitted = await generateProviderImage(IMAGE_PROVIDER_ID, { prompt: "portrait" });

    expect(explicit.model).toBe("stub-only-model");
    expect(omitted.model).toBe(DEFAULT_IMAGE_MODEL);
    expect(explicit.mimeType).toBe("image/png");
    expect(explicit.base64).toBe(omitted.base64);
    expect(lookup).not.toHaveBeenCalled();
    expect(completion).not.toHaveBeenCalled();
    expect(requests).toEqual([]);
  });
});
