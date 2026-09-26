import { createNewProjectSeed, genrePackById, evaluateGenrePackConfiguration } from "../../src/editor/genrePacks";
const p = createNewProjectSeed("adventure-jrpg", "JRPG");
const s = p.system as Record<string, unknown>;
const keys = ["genre","battleUiStyle","battleParty","battleFlow","menuUiStyle","dialogueStyle","companions","rewardPolicy"];
const pack = genrePackById("adventure-jrpg");
process.stdout.write(JSON.stringify({ system: Object.fromEntries(keys.map(k => [k, s[k] ?? null])), appliesSystemFields: pack.recipes[0]!.appliesSystemFields, requirements: pack.runtimeRequirements.map(r => r.id), blankConfig: evaluateGenrePackConfiguration(p, "adventure-jrpg").checks }, null, 1));
