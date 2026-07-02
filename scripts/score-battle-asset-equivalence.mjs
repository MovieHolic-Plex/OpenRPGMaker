import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const manifestPath = args.get("manifest");
const outPath = args.get("out");
const coldOutPath = args.get("cold-out");
const allowBelowThreshold = args.has("allow-below-threshold");
const threshold = Number(args.get("threshold") ?? "95");

if (!manifestPath || (!outPath && !coldOutPath)) {
  console.error("Usage: node scripts/score-battle-asset-equivalence.mjs --manifest <manifest.json> --out <score.json> [--cold-out <score.md>] [--allow-below-threshold]");
  process.exit(2);
}

const manifest = JSON.parse(stripBom(await readFile(manifestPath, "utf8")));
const screenshotLookup = screenshotsByName(manifest);
const pairs = [
  {
    state: "command",
    reference: "output/evidence/battle-scene-reference-20260630/reference-01-command.png",
    candidate: screenshotLookup.get("wide-1920/01-command-full.png") ?? screenshotLookup.get("desktop-1360/01-command-full.png"),
  },
  {
    state: "target",
    reference: "output/evidence/battle-scene-reference-20260630/reference-02-target.png",
    candidate: screenshotLookup.get("wide-1920/04-target-full.png") ?? screenshotLookup.get("desktop-1360/04-target-full.png"),
  },
  {
    state: "result",
    reference: "output/evidence/battle-scene-reference-20260630/reference-03-result.png",
    candidate: screenshotLookup.get("wide-1920/07-result-full.png") ?? screenshotLookup.get("desktop-1360/07-result-full.png"),
  },
];

for (const pair of pairs) {
  if (!pair.candidate) throw new Error(`missing candidate screenshot for ${pair.state}`);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const scores = [];
  for (const pair of pairs) {
    const comparison = await compareImages(page, pair.reference, pair.candidate);
    scores.push({
      state: pair.state,
      reference: pair.reference,
      candidate: pair.candidate,
      pixelSimilarityPercent: comparison.similarityPercent,
      sceneCropSimilarityPercent: comparison.similarityPercent,
      dimensions: comparison.dimensions,
      method: "browser-canvas normalized full-frame RGB mean absolute difference",
    });
  }
  const pass = scores.every((score) => score.sceneCropSimilarityPercent >= threshold);
  const payload = {
    generatedAt: new Date().toISOString(),
    threshold,
    pass,
    scores,
  };
  if (outPath) await writeJson(outPath, payload);
  if (coldOutPath) await writeFile(coldOutPath, coldScoreMarkdown(payload), "utf8");
  console.log(JSON.stringify(payload, null, 2));
  if (!pass && !allowBelowThreshold) process.exit(1);
} finally {
  await browser.close();
}

async function compareImages(page, referencePath, candidatePath) {
  const reference = await imageDataUrl(referencePath);
  const candidate = await imageDataUrl(candidatePath);
  return page.evaluate(async ({ reference, candidate }) => {
    const [referenceImage, candidateImage] = await Promise.all([loadImage(reference), loadImage(candidate)]);
    const width = referenceImage.naturalWidth;
    const height = referenceImage.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("missing canvas context");
    context.imageSmoothingEnabled = true;
    context.drawImage(referenceImage, 0, 0, width, height);
    context.drawImage(candidateImage, width, 0, width, height);
    const left = context.getImageData(0, 0, width, height).data;
    const right = context.getImageData(width, 0, width, height).data;
    let delta = 0;
    for (let index = 0; index < left.length; index += 4) {
      delta += Math.abs(left[index] - right[index]);
      delta += Math.abs(left[index + 1] - right[index + 1]);
      delta += Math.abs(left[index + 2] - right[index + 2]);
    }
    const maxDelta = width * height * 255 * 3;
    return {
      similarityPercent: Number(((1 - delta / maxDelta) * 100).toFixed(2)),
      dimensions: {
        reference: { width, height },
        candidate: { width: candidateImage.naturalWidth, height: candidateImage.naturalHeight },
      },
    };
    function loadImage(src) {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`failed to load image ${src.slice(0, 64)}`));
        image.src = src;
      });
    }
  }, { reference, candidate });
}

async function imageDataUrl(path) {
  const bytes = await readFile(resolve(path));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

function screenshotsByName(value) {
  const map = new Map();
  for (const viewport of value.viewports ?? []) {
    for (const screenshot of viewport.screenshots ?? []) {
      const normalized = String(screenshot).replaceAll("\\", "/");
      const marker = "/battle-scene-reference-20260630/final/";
      const index = normalized.indexOf(marker);
      const key = index >= 0 ? normalized.slice(index + marker.length) : normalized;
      map.set(key, screenshot);
    }
  }
  return map;
}

function coldScoreMarkdown(payload) {
  const blockers = payload.scores.filter((score) => score.sceneCropSimilarityPercent < payload.threshold);
  const score = Math.min(100, Math.round(payload.scores.reduce((sum, entry) => sum + entry.sceneCropSimilarityPercent, 0) / payload.scores.length));
  return `# Battle Asset Equivalence Cold Score

Score: ${score} / 100

Threshold: ${payload.threshold}% scene-crop similarity.
Status: ${payload.pass ? "PASS" : "FAIL"}

## Scores

${payload.scores.map((entry) => `- ${entry.state}: ${entry.sceneCropSimilarityPercent}% (${entry.method})`).join("\n")}

## Findings

${blockers.length === 0 ? "- No P1/P2 visual similarity blockers by computed threshold." : blockers.map((entry) => `- P1: ${entry.state} remains below ${payload.threshold}% at ${entry.sceneCropSimilarityPercent}%.`).join("\n")}

## Interpretation

This score is computed from real browser screenshots, not DOM assertions. If it fails, the current UI may still be much more usable, but it has not met the requested 95% visual-equivalence bar.
`;
}

function parseArgs(values) {
  const map = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      map.set(key, "true");
    } else {
      map.set(key, next);
      index += 1;
    }
  }
  return map;
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function stripBom(value) {
  return value.replace(/^\uFEFF/, "");
}
