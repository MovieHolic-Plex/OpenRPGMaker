import { describe, expect, it, vi } from "vitest";
import { IMAGE_GENERATION_MODEL, IMAGE_GENERATION_PROVIDER_ID, ImageGenerationError, generateAiImage, imageGenerationEndpoint, imageGenerationUsesOtherProvider } from "@/ai/imageGenerationClient";
import { IMAGE_CHATGPT_LOGIN_REQUIRED, RECOMMENDED_IMAGE_MODEL, RECOMMENDED_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";
import { defaultAiConfig } from "@/ai/llmClient";
import { closestLibraryPictures, imageFailureNextStep, isImageCredentialFailure } from "@/editor/imageGenerationFallback";
import { generateOpeningStill } from "@/editor/openingImageGeneration";
import { generateTitleArt } from "@/editor/titleArtGeneration";
import { createImageGenerationQueue } from "@/ai/imageGenerationQueue";
import { getTool } from "@/editor/tools";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { IMAGE_GENERATION_UNAVAILABLE_CODE, imageGenerationFailureCode, imageGenerationUnavailableError, imageGenerationUnavailableInstruction, imageUnavailableGateNotice } from "@/editor/imageGenerationNotice";
import { isImageGenerationUnavailableResult, reportImageGenerationUnavailable } from "@/editor/panels/imageGenerationGate";
import { isolateTimers } from "./mergedTeardown";

describe("imageGenerationClient", () => {
  isolateTimers();
  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }
  describe("imageGenerationClient", () => {
    it("defaults to the ChatGPT image provider, not Gemini", () => {
      expect(IMAGE_GENERATION_PROVIDER_ID).toBe("openai-codex");
      expect(IMAGE_GENERATION_MODEL).toBe("codex-image-default");
    });

    it("동반 서비스의 같은 오리진 /v1 경로를 친다", () => {
      expect(imageGenerationEndpoint()).toBe("/v1/images/generations");
    });

    it("그림은 항상 이미지 지원 제공자로 보낸다", async () => {
      const seen: { url: string; provider: string; body: unknown }[] = [];
      const image = await generateAiImage(
        { prompt: "슬라임" },
        {
          fetch: async (input, init) => {
            const headers = new Headers(init?.headers);
            seen.push({
              url: String(input),
              provider: headers.get("X-Oprn-Provider") ?? "",
              body: JSON.parse(String(init?.body ?? "{}")),
            });
            return jsonResponse({
              image: {
                dataUrl: "data:image/png;base64,AAA",
                mimeType: "image/png",
                model: IMAGE_GENERATION_MODEL,
                provider: IMAGE_GENERATION_PROVIDER_ID,
              },
            });
          },
        },
      );

      expect(seen).toHaveLength(1);
      expect(seen[0]!.url).toBe("/v1/images/generations");
      expect(seen[0]!.provider).toBe(RECOMMENDED_IMAGE_PROVIDER_ID);
      expect(seen[0]!.body).toEqual({ prompt: "슬라임", model: RECOMMENDED_IMAGE_MODEL });
      expect(image.dataUrl).toBe("data:image/png;base64,AAA");
    });

    it("빈 프롬프트는 요청 전에 거부한다", async () => {
      let calls = 0;
      await expect(
        generateAiImage({ prompt: "  " }, { fetch: async () => { calls += 1; return jsonResponse({}); } }),
      ).rejects.toThrow(ImageGenerationError);
      expect(calls).toBe(0);
    });

    it("사용자 중단과 요청 시간 초과를 구분한다", async () => {
      const abortError = new DOMException("중단", "AbortError");
      const controller = new AbortController();
      controller.abort();

      await expect(
        generateAiImage({ prompt: "슬라임", signal: controller.signal }, { fetch: async () => { throw abortError; } }),
      ).rejects.toThrow("생성을 취소했습니다");
      await expect(
        generateAiImage({ prompt: "슬라임" }, { fetch: async () => { throw abortError; } }),
      ).rejects.toThrow("이미지 생성이 시간 안에 끝나지 않았습니다.");
    });

    it("서버 오류 본문의 사람이 읽는 메시지를 그대로 올린다", async () => {
      await expect(
        generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ error: "이미지 생성은 …만 지원합니다." }, 409) }),
      ).rejects.toThrow("이미지 생성은 …만 지원합니다.");
    });

    it("ChatGPT 인증에 실패하면 다른 제공자를 부르지 않고 로그인 안내를 올린다", async () => {
      const seen: [string | null, string][] = [];
      const result = generateAiImage(
        { prompt: "슬라임", model: "gemini-3.1-flash-image", providerId: "google-antigravity" },
        { fetch: async (_input, init) => {
          seen.push([new Headers(init?.headers).get("X-Oprn-Provider"), JSON.parse(String(init?.body)).model]);
          return jsonResponse({ error: "Unauthorized" }, 401);
        } },
      );
      await expect(result).rejects.toBeInstanceOf(ImageGenerationError);
      await expect(result).rejects.toMatchObject({ message: IMAGE_CHATGPT_LOGIN_REQUIRED, status: 401 });
      expect(seen).toEqual([["openai-codex", "codex-image-default"]]);
    });

    it("dataUrl 이 없는 200 응답도 실패로 본다", async () => {
      await expect(
        generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ image: { mimeType: "image/png" } }) }),
      ).rejects.toThrow(ImageGenerationError);
    });

    it("대화 제공자와 그림 제공자가 같을 때만 다른 제공자 안내가 필요 없다", () => {
      const config = { ...defaultAiConfig(), providerId: "google-antigravity" };
      expect(config.imageProviderId).toBe(IMAGE_GENERATION_PROVIDER_ID);
      expect(imageGenerationUsesOtherProvider(config)).toBe(true);
      expect(imageGenerationUsesOtherProvider({ ...config, providerId: "openai-codex" })).toBe(false);
    });
  });
});

describe("imageGenerationFallback", () => {
  isolateTimers();
  // 2026-10-25 심사(salad-omo-1 「그림 생성이 Google 로그인 요구」 7건): 그림 연결이 없을 때 실패 안내가 «제작을 멈추라»고 시켜 턴이 멈췄다.
  const LOGIN = "이미지를 만들려면 AI 설정 → Google Antigravity 로그인에서 연결해 주세요.";
  const noLogin = async () => { throw new ImageGenerationError(LOGIN, 401); };
  describe("image generation fallback when the image login is missing", () => {
    it("treats a missing login as a failure that won't clear up during this run", () => {
      expect(isImageCredentialFailure(new ImageGenerationError(LOGIN, 401))).toBe(true);
      expect(isImageCredentialFailure(new ImageGenerationError("이미지 생성이 시간 안에 끝나지 않았습니다."))).toBe(false);
    });

    it("names the closest library pictures by description, skipping city skylines for a fairy-tale scene", () => {
      const picks = closestLibraryPictures("동화 같은 숲 마을의 밤");
      expect(picks.length).toBeGreaterThan(0);
      expect(picks.some((pick) => /skyline|city/u.test(pick.id))).toBe(false);
    });

    it("the next step says to keep building, never to stop", () => {
      const step = imageFailureNextStep("title", "숲 마을", new ImageGenerationError(LOGIN, 401));
      expect(step).toContain("다시 부르지 마라");
      expect(step).toContain("계속한다");
      expect(step).toContain("턴을 멈추지 않는다");
      expect(step).not.toContain("멈추고");
    });

    it("opening and title-art failures carry the fallback instead of a stop order", async () => {
      const opening = await generateOpeningStill({ prompt: "새벽 안개 낀 숲속 마을 광장, 아무도 없는 풍경" }, { generateImage: noLogin });
      expect(opening.ok).toBe(false);
      if (!opening.ok) {
        expect(opening.summary).toContain("Antigravity");
        expect(opening.summary).toContain("턴을 멈추지 않는다");
        expect(opening.summary).not.toContain("제작을 멈추고");
      }
      const title = await generateTitleArt({ prompt: "동화 공방의 오르골" }, { generateImage: noLogin, fitEffects: false });
      expect(title.ok).toBe(false);
      if (!title.ok) expect(title.summary).toContain("set_title_screen");
    });
  });
});

describe("imageGenerationQueue", () => {
  isolateTimers();
  function deferred<T>(): {
    readonly promise: Promise<T>;
    readonly resolve: (value: T) => void;
    readonly reject: (error: unknown) => void;
  } {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((innerResolve, innerReject) => {
      resolve = innerResolve;
      reject = innerReject;
    });
    return { promise, resolve, reject };
  }
  describe("imageGenerationQueue", () => {
    it("빈 프롬프트는 넣지 않는다", () => {
      const queue = createImageGenerationQueue({ runner: async () => "x" });
      expect(() => queue.enqueue({ prompt: "  " })).toThrow();
      expect(queue.getSnapshot().jobs).toHaveLength(0);
    });

    it("작업은 들어온 순서대로 끝나고 상태가 전이된다", async () => {
      const order: string[] = [];
      const queue = createImageGenerationQueue({
        runner: async (job) => {
          order.push(job.label);
          return `data:${job.label}`;
        },
      });
      const seen: string[][] = [];
      queue.subscribe((snapshot) => seen.push(snapshot.jobs.map((job) => job.status)));
      const first = queue.enqueue({ prompt: "슬라임", kind: "backdrop" });
      const second = queue.enqueue({ prompt: "고블린", kind: "backdrop" });
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs.every((job) => job.status === "done")).toBe(true);
      });
      expect(order).toEqual(["슬라임", "고블린"]);
      const jobs = queue.getSnapshot().jobs;
      expect(jobs.map((job) => job.id)).toEqual([first, second]);
      expect(jobs[0]!.attempts).toBe(1);
      expect(jobs[0]!.result).toBe("data:슬라임");
      expect(seen.flat()).toContain("running");
      expect(queue.getSnapshot().queued).toBe(0);
      expect(queue.getSnapshot().running).toBe(0);
    });

    it("동시성은 직렬이 기본이고 실패한 작업은 에러를 들고 멈춘다", async () => {
      let active = 0;
      let peak = 0;
      const queue = createImageGenerationQueue({
        runner: async (job) => {
          active += 1;
          peak = Math.max(peak, active);
          try {
            if (job.label === "깨짐") throw new Error("서버 불량");
            await new Promise((resolve) => setTimeout(resolve, 5));
            return "ok";
          } finally {
            active -= 1;
          }
        },
      });
      queue.enqueue({ prompt: "하나" });
      queue.enqueue({ prompt: "깨짐" });
      queue.enqueue({ prompt: "셋" });
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs.filter((job) => job.status === "done")).toHaveLength(2);
      });
      expect(peak).toBe(1);
      const snapshot = queue.getSnapshot();
      expect(snapshot.failed).toBe(1);
      const failed = snapshot.jobs.find((job) => job.label === "깨짐")!;
      expect(failed.status).toBe("error");
      expect(failed.error).toBe("서버 불량");
    });

    it("실행 중 취소는 결과를 버리고 다음 작업을 돌린다", async () => {
      const gate = deferred<string>();
      const started: string[] = [];
      const queue = createImageGenerationQueue({
        runner: async (job, options) => {
          started.push(job.label);
          if (job.label === "느림") {
            // runner 가 signal 을 무시하고 늦게 resolve 해도 큐는 버려야 한다.
            void options.signal;
            return gate.promise;
          }
          return "fast";
        },
      });
      const slow = queue.enqueue({ prompt: "느림" });
      queue.enqueue({ prompt: "빠름" });
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs.find((job) => job.id === slow)?.status).toBe("running");
      });
      expect(queue.cancel(slow)).toBe(true);
      gate.resolve("late-data");
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs.find((job) => job.label === "빠름")?.status).toBe("done");
      });
      const slowJob = queue.getSnapshot().jobs.find((job) => job.id === slow)!;
      expect(slowJob.status).toBe("cancelled");
      expect(slowJob.result).toBeNull();
      expect(started).toEqual(["느림", "빠름"]);
      queue.dispose();
    });

    it("취소 후 재시도하면 이전 실행의 늦은 결과는 버린다", async () => {
      const first = deferred<string>();
      const second = deferred<string>();
      let calls = 0;
      const queue = createImageGenerationQueue({
        runner: async () => {
          calls += 1;
          return calls === 1 ? first.promise : second.promise;
        },
      });
      const id = queue.enqueue({ prompt: "느림" });
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs[0]?.status).toBe("running");
      });
      expect(queue.cancel(id)).toBe(true);
      expect(queue.retry(id)).toBe(true);
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs[0]?.attempts).toBe(2);
      });
      // 취소된 첫 실행이 늦게 성공해도 재시도 실행에는 닿지 않는다. 첫 promise 의
      // continuation 은 runOne 이 먼저 붙였으므로, 여기서 await 하면 stale 분기가
      // 완전히 정착한 뒤에 깨어난다(고정 sleep 없이 결정적이다).
      first.resolve("stale-data");
      await first.promise;
      const during = queue.getSnapshot().jobs[0]!;
      expect(during.status).toBe("running");
      expect(during.result).toBeNull();
      // 재시도 실행의 결과만 적용된다.
      second.resolve("fresh-data");
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs[0]?.status).toBe("done");
      });
      expect(queue.getSnapshot().jobs[0]?.result).toBe("fresh-data");
      queue.dispose();
    });

    it("대기 중 취소는 runner 를 부르지 않고 재시도하면 다시 돈다", async () => {
      const gate = deferred<string>();
      let calls = 0;
      const queue = createImageGenerationQueue({
        runner: async (job) => {
          calls += 1;
          if (job.label === "차단") return gate.promise;
          if (calls === 2) throw new Error("한 번 실패");
          return "recovered";
        },
      });
      queue.enqueue({ prompt: "차단" });
      const waiting = queue.enqueue({ prompt: "대기" });
      expect(queue.cancel(waiting)).toBe(true);
      expect(calls).toBe(1);
      gate.resolve("blocker-done");
      const failed = queue.enqueue({ prompt: "실패" });
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.status).toBe("error");
      });
      expect(queue.retry(failed)).toBe(true);
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.status).toBe("done");
      });
      expect(queue.getSnapshot().jobs.find((job) => job.id === failed)?.attempts).toBe(2);
      expect(queue.cancel(failed)).toBe(false);
      expect(queue.retry(failed)).toBe(false);
    });

    it("clearFinished 는 끝난 것만 걷고 실패는 남긴다", async () => {
      const queue = createImageGenerationQueue({
        runner: async (job) => {
          if (job.label === "깨짐") throw new Error("불량");
          return "ok";
        },
      });
      queue.enqueue({ prompt: "성공" });
      const bad = queue.enqueue({ prompt: "깨짐" });
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs.every((job) => job.status !== "queued" && job.status !== "running")).toBe(true);
      });
      queue.clearFinished();
      const remaining = queue.getSnapshot().jobs;
      expect(remaining.map((job) => job.id)).toEqual([bad]);
    });

    it("구독 해지는 이후 알림을 받지 않는다", () => {
      const queue = createImageGenerationQueue({ runner: async () => "x" });
      let calls = 0;
      const off = queue.subscribe(() => {
        calls += 1;
      });
      queue.enqueue({ prompt: "하나" });
      const afterEnqueue = calls;
      off();
      queue.enqueue({ prompt: "둘" });
      expect(calls).toBe(afterEnqueue);
      queue.dispose();
    });

    it("concurrency 상한은 1~4 로 고정된다", async () => {
      let active = 0;
      let peak = 0;
      const queue = createImageGenerationQueue({
        concurrency: 99,
        runner: async () => {
          active += 1;
          peak = Math.max(peak, active);
          await new Promise((resolve) => setTimeout(resolve, 5));
          active -= 1;
          return "ok";
        },
      });
      for (let index = 0; index < 8; index += 1) queue.enqueue({ prompt: `작업${index}` });
      await vi.waitFor(() => {
        expect(queue.getSnapshot().jobs.every((job) => job.status === "done")).toBe(true);
      });
      expect(peak).toBeLessThanOrEqual(4);
      queue.dispose();
    });
  });
});

describe("imageGenerationUnavailableNotice", () => {
  isolateTimers();
  describe("image generation unavailable — loud failure", () => {
    it("keeps the wire code that every surface matches on", () => {
      expect(IMAGE_GENERATION_UNAVAILABLE_CODE).toBe("image-generation-unavailable");
    });

    it("returns a hard error that carries the code and the agent instruction verbatim", () => {
      const error = imageGenerationUnavailableError();
      expect(error.name).toBe("ToolError");
      expect(error.code).toBe(IMAGE_GENERATION_UNAVAILABLE_CODE);
      expect(error.message).toBe(imageGenerationUnavailableInstruction());
    });

    it("materialises a gate notice of the image-unavailable kind with one reason and one fix", () => {
      const notice = imageUnavailableGateNotice();
      expect(notice.kind).toBe("image-unavailable");
      expect(notice.reasons).toHaveLength(1);
      expect(notice.nextSteps).toHaveLength(1);
    });

    it("recognises the failure result only through the code and raises the gate once", () => {
      const shown: string[] = [];
      const raised = reportImageGenerationUnavailable(
        { summary: `x ${IMAGE_GENERATION_UNAVAILABLE_CODE} y` },
        (notice) => shown.push(notice.kind),
      );
      expect(raised).toBe(true);
      expect(shown).toEqual(["image-unavailable"]);
      expect(isImageGenerationUnavailableResult({ summary: "정상 완료" })).toBe(false);
      expect(isImageGenerationUnavailableResult({ issues: [{ code: IMAGE_GENERATION_UNAVAILABLE_CODE }] })).toBe(true);
    });

    it("raises the same loud code for a credential failure, not a generic image failure", () => {
      // 자동 Google 대체를 없애면서 「자격 없음」이 새로 도달 가능해졌다 — 그 실패가 조용한 일반 실패로 남으면
      // 캔버스 띠·차단 모달이 뜨지 않는다. 일시 오류는 한 번 더 시도할 수 있으므로 구분을 유지한다.
      expect(imageGenerationFailureCode(new ImageGenerationError("ChatGPT 로그인이 필요합니다", 401))).toBe(IMAGE_GENERATION_UNAVAILABLE_CODE);
      expect(imageGenerationFailureCode(new ImageGenerationError("일시 오류", 502))).toBe("image-generation-failed");
      expect(imageGenerationFailureCode(new Error("network down"))).toBe("image-generation-failed");
    });

    it("fails the real registry tool hard with that code instead of reporting success", () => {
      expect(getTool("generate_opening_image")?.mode).toBe("write");
      const result = runTool({ project: createBlankProject() }, "generate_opening_image", { prompt: "폐허가 된 성문 앞의 새벽" });
      expect(result.ok).toBe(false);
      expect(result.issues?.map((issue) => issue.code)).toContain(IMAGE_GENERATION_UNAVAILABLE_CODE);
      expect(isImageGenerationUnavailableResult(result)).toBe(true);
    });
  });
});
