#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const wikiDir = path.join(root, "openwiki");
const agentEntryPath = path.join(root, "AGENTS.md");

const requiredPages = [
  {
    file: "PROJECT_WIKI.md",
    terms: ["AI-facing", "project-specific", "AGENTS.md", "openwiki", "Staleness rule"],
  },
  {
    file: "ai-workflow.md",
    terms: ["Before changing files", "After changing files", "npm run openwiki:verify", "browser", "credentials"],
  },
  {
    file: "quickstart.md",
    terms: ["AGENTS.md", "PROJECT_WIKI.md", "src/main.ts", "src/editor", "src/player", "src/project"],
  },
  {
    file: "architecture.md",
    terms: ["src/main.ts", "src/editor", "src/player", "src/project", "Phaser"],
  },
  {
    file: "editor-workflows.md",
    terms: ["map", "event", "database", "resource", "src/editor"],
  },
  {
    file: "runtime-and-data.md",
    terms: ["PlayScene", "interpreter", "battle", "session", "src/project"],
  },
  {
    file: "testing.md",
    terms: ["npm test", "npm run typecheck", "playwright", "vitest", "test/e2e"],
  },
];

const secretPatterns = [/sk-[A-Za-z0-9_-]{20,}/u];

function readPage(file) {
  return readFileSync(path.join(wikiDir, file), "utf8");
}

function pageExists(file) {
  try {
    return statSync(path.join(wikiDir, file)).isFile();
  } catch {
    return false;
  }
}

function fileExists(file) {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

function readRootFile(file) {
  return readFileSync(path.join(root, file), "utf8");
}

const pages = requiredPages.map((page) => {
  const exists = pageExists(page.file);
  const content = exists ? readPage(page.file) : "";
  const missingTerms = page.terms.filter((term) => !content.toLowerCase().includes(term.toLowerCase()));
  const hasHeading = /^#\s+\S/mu.test(content);
  const hasSecret = secretPatterns.some((pattern) => pattern.test(content));
  return {
    file: page.file,
    exists,
    bytes: Buffer.byteLength(content, "utf8"),
    hasHeading,
    missingTerms,
    hasSecret,
  };
});

const extraFiles = pageExists(".") ? [] : [];
const allWikiFiles = readdirSync(wikiDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .sort();
const agentEntryExists = fileExists(agentEntryPath);
const agentEntryContent = agentEntryExists ? readRootFile("AGENTS.md") : "";
const agentEntryMissingTerms = ["openwiki/PROJECT_WIKI.md", "openwiki/editor-workflows.md", "openwiki/runtime-and-data.md"].filter(
  (term) => !agentEntryContent.includes(term),
);

const failures = [
  ...(agentEntryExists ? [] : ["AGENTS.md: missing"]),
  ...(agentEntryMissingTerms.length > 0 ? [`AGENTS.md: missing terms ${agentEntryMissingTerms.join(", ")}`] : []),
  ...pages.flatMap((page) => {
    const pageFailures = [];
    if (!page.exists) pageFailures.push(`${page.file}: missing`);
    if (page.exists && !page.hasHeading) pageFailures.push(`${page.file}: missing H1 heading`);
    if (page.exists && page.bytes < 300) pageFailures.push(`${page.file}: too small (${page.bytes} bytes)`);
    if (page.missingTerms.length > 0) pageFailures.push(`${page.file}: missing terms ${page.missingTerms.join(", ")}`);
    if (page.hasSecret) pageFailures.push(`${page.file}: contains secret-like token`);
    return pageFailures;
  }),
  ...extraFiles,
];

const report = {
  ok: failures.length === 0,
  agentEntry: {
    file: "AGENTS.md",
    exists: agentEntryExists,
    missingTerms: agentEntryMissingTerms,
  },
  requiredPages: pages,
  allWikiFiles,
  failures,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) process.exit(1);
