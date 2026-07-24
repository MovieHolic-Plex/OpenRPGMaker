import data from "./unicode15Data.json" with { type: "json" };

const MALFORMED = "Unicode 15 data contract is malformed";
const SCALAR_LIMIT = 0x10ffff;
const PAIR_RADIX = 0x110000;
const S_BASE = 0xac00;
const L_BASE = 0x1100;
const V_BASE = 0x1161;
const T_BASE = 0x11a7;
const L_COUNT = 19;
const V_COUNT = 21;
const T_COUNT = 28;
const N_COUNT = V_COUNT * T_COUNT;
const S_COUNT = L_COUNT * N_COUNT;
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const EXPECTED_COUNTS = Object.freeze({ decomposition: 5857, combiningClass: 922, composition: 945, casefold: 1530 });
const EXPECTED_SOURCES = Object.freeze({
  "UnicodeData.txt": [1913704, "806e9aed65037197f1ec85e12be6e8cd870fc5608b4de0fffd990f689f376a73"],
  "CaseFolding.txt": [84690, "cdd49e55eae3bbf1f0a3f6580c974a0263cb86a6a08daa10fbf705b4808a56f7"],
  "DerivedNormalizationProps.txt": [837688, "d5687a48c95c7d6e1ec59cb29c0f2e8b052018eb069a4371b7368d0561e12a29"],
  "CompositionExclusions.txt": [8911, "3b019c0a33c3140cbc920c078f4f9af2680ba4f71869c8d4de5190667c70b6a3"],
  "NormalizationTest.txt": [2625136, "fb9ac8cc154a80cad6caac9897af55a4e75176af6f4e2bb6edc2bf8b1d57f326"],
});

function fail() {
  throw new TypeError(MALFORMED);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function validateEnvelope() {
  if (!isRecord(data) || data.schemaVersion !== 1 || data.unicodeVersion !== "15.0.0"
    || data.algorithm !== "NFKC -> full casefold -> NFKC"
    || !hasExactKeys(data.counts, Object.keys(EXPECTED_COUNTS))
    || !hasExactKeys(data.streams, Object.keys(EXPECTED_COUNTS))
    || !hasExactKeys(data.sources, Object.keys(EXPECTED_SOURCES))) fail();
  for (const [name, count] of Object.entries(EXPECTED_COUNTS)) {
    if (data.counts[name] !== count || typeof data.streams[name] !== "string") fail();
  }
  for (const [name, [bytes, sha256]] of Object.entries(EXPECTED_SOURCES)) {
    const source = data.sources[name];
    if (!hasExactKeys(source, ["url", "bytes", "sha256"])
      || source.url !== `https://www.unicode.org/Public/15.0.0/ucd/${name}`
      || source.bytes !== bytes || source.sha256 !== sha256) fail();
  }
}

function decodeBase64(value) {
  if (value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) fail();
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const output = new Uint8Array((value.length / 4) * 3 - padding);
  let cursor = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = BASE64.indexOf(value[index]);
    const b = BASE64.indexOf(value[index + 1]);
    const c = value[index + 2] === "=" ? 0 : BASE64.indexOf(value[index + 2]);
    const d = value[index + 3] === "=" ? 0 : BASE64.indexOf(value[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) fail();
    const packed = a * 262144 + b * 4096 + c * 64 + d;
    if (cursor < output.length) output[cursor++] = Math.floor(packed / 65536);
    if (cursor < output.length) output[cursor++] = Math.floor(packed / 256) % 256;
    if (cursor < output.length) output[cursor++] = packed % 256;
  }
  return output;
}

function readVarint(state) {
  let value = 0;
  let factor = 1;
  let length = 0;
  while (state.offset < state.bytes.length) {
    const byte = state.bytes[state.offset++];
    value += (byte % 128) * factor;
    length += 1;
    if (byte < 128) {
      if ((length > 1 && byte === 0) || !Number.isSafeInteger(value)) fail();
      return value;
    }
    factor *= 128;
    if (factor > Number.MAX_SAFE_INTEGER || length >= 8) fail();
  }
  fail();
}

function isScalar(value) {
  return Number.isInteger(value) && value >= 0 && value <= SCALAR_LIMIT && (value < 0xd800 || value > 0xdfff);
}

function decodeSequenceMap(encoded, expectedCount) {
  const state = { bytes: decodeBase64(encoded), offset: 0 };
  const mapping = new Map();
  let key = 0;
  while (state.offset < state.bytes.length) {
    const delta = readVarint(state);
    const length = readVarint(state);
    if (delta <= 0 || length <= 0 || length > 32) fail();
    key += delta;
    if (!isScalar(key)) fail();
    const sequence = [];
    for (let index = 0; index < length; index += 1) {
      const value = readVarint(state);
      if (!isScalar(value)) fail();
      sequence.push(value);
    }
    mapping.set(key, Object.freeze(sequence));
  }
  if (mapping.size !== expectedCount) fail();
  return mapping;
}

function decodeScalarMap(encoded, expectedCount, validatePairKeys = false) {
  const state = { bytes: decodeBase64(encoded), offset: 0 };
  const mapping = new Map();
  let key = 0;
  while (state.offset < state.bytes.length) {
    const delta = readVarint(state);
    const value = readVarint(state);
    if (delta <= 0) fail();
    key += delta;
    if (validatePairKeys) {
      if (!isScalar(Math.floor(key / PAIR_RADIX)) || !isScalar(key % PAIR_RADIX) || !isScalar(value)) fail();
    } else if (!isScalar(key) || value <= 0 || value > 254) fail();
    mapping.set(key, value);
  }
  if (mapping.size !== expectedCount) fail();
  return mapping;
}

validateEnvelope();
const decomposition = decodeSequenceMap(data.streams.decomposition, EXPECTED_COUNTS.decomposition);
const combiningClass = decodeScalarMap(data.streams.combiningClass, EXPECTED_COUNTS.combiningClass);
const composition = decodeScalarMap(data.streams.composition, EXPECTED_COUNTS.composition, true);
const casefold = decodeSequenceMap(data.streams.casefold, EXPECTED_COUNTS.casefold);

function hangulDecomposition(codePoint) {
  const index = codePoint - S_BASE;
  if (index < 0 || index >= S_COUNT) return undefined;
  const lead = L_BASE + Math.floor(index / N_COUNT);
  const vowel = V_BASE + Math.floor((index % N_COUNT) / T_COUNT);
  const trailIndex = index % T_COUNT;
  return trailIndex === 0 ? [lead, vowel] : [lead, vowel, T_BASE + trailIndex];
}

function appendOrdered(output, codePoint) {
  const currentClass = combiningClass.get(codePoint) ?? 0;
  let index = output.length;
  if (currentClass !== 0) {
    while (index > 0) {
      const previousClass = combiningClass.get(output[index - 1]) ?? 0;
      if (previousClass === 0 || previousClass <= currentClass) break;
      index -= 1;
    }
  }
  output.splice(index, 0, codePoint);
}

function composePair(starter, codePoint) {
  const leadIndex = starter - L_BASE;
  const vowelIndex = codePoint - V_BASE;
  if (leadIndex >= 0 && leadIndex < L_COUNT && vowelIndex >= 0 && vowelIndex < V_COUNT) {
    return S_BASE + (leadIndex * V_COUNT + vowelIndex) * T_COUNT;
  }
  const syllableIndex = starter - S_BASE;
  const trailIndex = codePoint - T_BASE;
  if (syllableIndex >= 0 && syllableIndex < S_COUNT && syllableIndex % T_COUNT === 0
    && trailIndex > 0 && trailIndex < T_COUNT) return starter + trailIndex;
  return composition.get(starter * PAIR_RADIX + codePoint);
}

function compose(codePoints) {
  const output = [];
  let starterIndex = -1;
  let starter = 0;
  let previousClass = 0;
  for (const codePoint of codePoints) {
    const currentClass = combiningClass.get(codePoint) ?? 0;
    const composite = starterIndex < 0 ? undefined : composePair(starter, codePoint);
    if (composite !== undefined && (previousClass === 0 || previousClass < currentClass)) {
      output[starterIndex] = composite;
      starter = composite;
    } else {
      if (currentClass === 0) {
        starterIndex = output.length;
        starter = codePoint;
      }
      output.push(codePoint);
      previousClass = currentClass;
    }
  }
  return output;
}

function fromCodePoints(codePoints) {
  let output = "";
  const chunkSize = 4096;
  for (let index = 0; index < codePoints.length; index += chunkSize) {
    output += String.fromCodePoint(...codePoints.slice(index, index + chunkSize));
  }
  return output;
}

export function unicode15Nfkc(value) {
  if (typeof value !== "string") throw new TypeError("Unicode normalization input must be a string");
  const ordered = [];
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    const expanded = hangulDecomposition(codePoint) ?? decomposition.get(codePoint) ?? [codePoint];
    for (const item of expanded) appendOrdered(ordered, item);
  }
  return fromCodePoints(compose(ordered));
}

export function unicode15CaseFoldKey(value) {
  const normalized = unicode15Nfkc(value);
  const folded = [];
  for (const character of normalized) {
    const codePoint = character.codePointAt(0);
    folded.push(...(casefold.get(codePoint) ?? [codePoint]));
  }
  return unicode15Nfkc(fromCodePoints(folded));
}
