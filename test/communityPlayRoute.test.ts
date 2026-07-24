import {
  createPlayerBootPaths,
  injectPlayerBootConfig,
  parsePlayerBootConfigJson,
  serializePlayerBootConfigForScript,
} from "../community-site/lib/playerBootConfig";
import {
  createCommunityPlayRouteHandler,
  type CommunityPlayRouteOptions,
  type PlayGameRecord,
} from "../community-site/lib/playRoute";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { describe, expect, it } from "vitest";

const PLAYER_HTML = "<!doctype html><html><head><title>Player</title></head><body><div id=\"app\"></div></body></html>";
const SAFE_PROJECT_JSON = serialize(createBlankProject());

function packageRecord(projectJson = SAFE_PROJECT_JSON): PlayGameRecord {
  return { packageBase64: Buffer.from(projectJson).toString("base64") };
}

function routeOptions(overrides: Partial<CommunityPlayRouteOptions> = {}): CommunityPlayRouteOptions {
  return {
    loadGame: async () => packageRecord(),
    loadPlayerFile: async (relativePath) => relativePath === "player.html"
      ? new Response(PLAYER_HTML, { headers: { "Content-Type": "text/html" } })
      : null,
    loadRuntimeFile: async () => null,
    readProjectJson: (bytes) => bytes.toString("utf8"),
    validateProjectJson: (json) => {
      deserialize(json);
    },
    ...overrides,
  };
}

function bootConfigFromHtml(html: string): unknown {
  const marker = "window.__OPENRPG_BOOT__=";
  const start = html.indexOf(marker);
  const end = html.indexOf(";</script>", start);
  if (start < 0 || end < 0) return null;
  return JSON.parse(html.slice(start + marker.length, end));
}

describe("community player boot configuration", () => {
  it("roundtrips a Korean reserved-character slug without creating executable markup", () => {
    // Given
    const slug = '한글 </script><script id="owned">alert(1)</script> %/?&';

    // When
    const paths = createPlayerBootPaths({ slug, lang: "ko" });
    const html = injectPlayerBootConfig(PLAYER_HTML, paths);

    // Then
    expect(html).not.toContain('<script id="owned">');
    expect(html).not.toContain("</script><script");
    expect(paths.baseHref).toBe(`/play/${encodeURIComponent(slug)}/`);
    expect(bootConfigFromHtml(html)).toEqual({
      projectUrl: `/play/${encodeURIComponent(slug)}/project.json`,
      saveNamespace: `rpgzzu-export:${slug}`,
      returnUrl: `/ko/games/${encodeURIComponent(slug)}`,
      hostFeatures: ["exit", "fullscreen"],
    });
  });

  it("keeps the save namespace stable when the same slug is serialized repeatedly", () => {
    // Given
    const input = { slug: "마을 save/%", lang: "en" } as const;

    // When
    const first = createPlayerBootPaths(input);
    const second = createPlayerBootPaths(input);

    // Then
    expect(first.config.saveNamespace).toBe(second.config.saveNamespace);
    expect(first.config.returnUrl).toBe(`/en/games/${encodeURIComponent(input.slug)}`);
  });

  it("parses the serialized typed contract and rejects malformed host features value-free", () => {
    // Given
    const config = createPlayerBootPaths({ slug: "parser </script>", lang: "en" }).config;
    const canary = "private-host-feature";

    // When
    const parsed = parsePlayerBootConfigJson(serializePlayerBootConfigForScript(config));
    let malformedMessage = "";
    try {
      parsePlayerBootConfigJson(JSON.stringify({ ...config, hostFeatures: [canary] }));
    } catch (error) {
      if (error instanceof Error) malformedMessage = error.message;
    }

    // Then
    expect(parsed).toEqual(config);
    expect(malformedMessage).toBe("player boot configuration is invalid");
    expect(malformedMessage).not.toContain(canary);
  });
});

describe("community play route", () => {
  it("serves a verified visible game shell with localized host configuration", async () => {
    // Given
    const seenSlugs: string[] = [];
    const handler = createCommunityPlayRouteHandler(routeOptions({
      loadGame: async (slug) => {
        seenSlugs.push(slug);
        return packageRecord();
      },
    }));
    const request = new Request("https://community.test/play/%ED%95%9C%EA%B8%80?lang=ko");

    // When
    const response = await handler(request, { slug: "한글" });
    const html = await response.text();

    // Then
    expect(response.status).toBe(200);
    expect(seenSlugs).toEqual(["한글"]);
    expect(bootConfigFromHtml(html)).toMatchObject({
      returnUrl: "/ko/games/%ED%95%9C%EA%B8%80",
      hostFeatures: ["exit", "fullscreen"],
    });
  });

  it("returns a visible 404 before serving the shell when the game is missing or invisible", async () => {
    // Given
    const handler = createCommunityPlayRouteHandler(routeOptions({ loadGame: async () => null }));

    // When
    const response = await handler(new Request("https://community.test/play/hidden"), { slug: "hidden" });
    const body = await response.text();

    // Then
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain('data-testid="player-route-error"');
    expect(body).not.toContain("packageBase64");
  });

  it("returns a visible value-free 500 before the shell when the stored package is corrupt", async () => {
    // Given
    const canary = "postgres://secret@db/C:/host/private.oprn";
    const handler = createCommunityPlayRouteHandler(routeOptions({
      readProjectJson: () => {
        throw new Error(canary);
      },
    }));

    // When
    const response = await handler(new Request("https://community.test/play/corrupt?lang=en"), { slug: "corrupt" });
    const body = await response.text();

    // Then
    expect(response.status).toBe(500);
    expect(body).toContain('data-testid="player-route-error"');
    expect(body).not.toContain(canary);
    expect(body).not.toContain("postgres://");
  });

  it("rejects a syntactically valid object that fails the real editor project schema", async () => {
    // Given
    const handler = createCommunityPlayRouteHandler(routeOptions({ readProjectJson: () => "{}" }));

    // When
    const response = await handler(new Request("https://community.test/play/schema-invalid?lang=en"), {
      slug: "schema-invalid",
    });

    // Then
    expect(response.status).toBe(500);
    expect(await response.text()).toContain("The game could not be loaded.");
  });

  it("turns a database failure into a deterministic value-free 500 response", async () => {
    // Given
    const canary = "COMMUNITY_DATABASE_URL=postgres://private-host";
    const handler = createCommunityPlayRouteHandler(routeOptions({
      loadGame: async () => {
        throw new Error(canary);
      },
    }));

    // When
    const response = await handler(new Request("https://community.test/play/db-failure"), { slug: "db-failure" });
    const body = await response.text();

    // Then
    expect(response.status).toBe(500);
    expect(body).not.toContain(canary);
    expect(body).not.toContain("private-host");
  });

  it("treats an already-decoded percent sign in a framework slug as data", async () => {
    // Given
    const seenSlugs: string[] = [];
    const handler = createCommunityPlayRouteHandler(routeOptions({
      loadGame: async (slug) => {
        seenSlugs.push(slug);
        return packageRecord();
      },
    }));

    // When
    const response = await handler(new Request("https://community.test/play/100%25-legit"), { slug: "100%-legit" });

    // Then
    expect(response.status).toBe(200);
    expect(seenSlugs).toEqual(["100%-legit"]);
  });

  it("keeps project resource status codes distinct without exposing corrupt package details", async () => {
    // Given
    const missing = createCommunityPlayRouteHandler(routeOptions({ loadGame: async () => null }));
    const corrupt = createCommunityPlayRouteHandler(routeOptions({
      readProjectJson: () => {
        throw new Error("C:/private/project.json project.json entry is missing");
      },
    }));

    // When
    const missingResponse = await missing(new Request("https://community.test/play/missing/project.json"), {
      slug: "missing",
      path: ["project.json"],
    });
    const corruptResponse = await corrupt(new Request("https://community.test/play/corrupt/project.json"), {
      slug: "corrupt",
      path: ["project.json"],
    });

    // Then
    expect(missingResponse.status).toBe(404);
    expect(corruptResponse.status).toBe(500);
    expect(await corruptResponse.text()).not.toContain("C:/private");
  });

  it("rejects traversal segments with 400 and uses 404 for a missing safe asset", async () => {
    // Given
    const handler = createCommunityPlayRouteHandler(routeOptions());

    // When
    const traversal = await handler(new Request("https://community.test/play/game/%2e%2e/secret"), {
      slug: "game",
      path: ["..", "secret"],
    });
    const missing = await handler(new Request("https://community.test/play/game/missing.js"), {
      slug: "game",
      path: ["missing.js"],
    });

    // Then
    expect(traversal.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
