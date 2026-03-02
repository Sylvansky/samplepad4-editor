const path = require("path");

const SAMPLEPAD4_FILE_SIZE = 3200;
const HEADER_MAGIC = "KITH";
const BLOCK_MAGIC = "KITI";
const HEADER_SIZE = 0x80;
const BLOCK_SIZE = 0x100;
const PAD_COUNT = 6;
const BLOCK2_START = 0x680;

const PAD_LABELS = [
  "Pad 1",
  "Pad 2",
  "Pad 3",
  "Pad 4",
  "Trigger 1",
  "Trigger 2",
];

const MEMLOC = {
  midiNote: 0x39,
  layerAFlag: 0x80,
  velocityMinA: 0x82,
  velocityMaxA: 0x83,
  fileNameLengthA: 0x87,
  displayNameA: 0x88,
  fileNameA: 0x90,
};

function readAsciiZeroTrim(buffer, offset, length) {
  return buffer
    .toString("ascii", offset, offset + length)
    .replace(/\0/g, "")
    .trimEnd();
}

function sanitizeSampleName(stem) {
  const cleaned = (stem || "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^A-Za-z0-9_]/g, "");

  return cleaned;
}

function uniqueSuggestion(base, usedSuggestions) {
  if (!base) {
    let fallbackCounter = 1;
    while (fallbackCounter < 1000) {
      const fallback = `SMP${String(fallbackCounter).padStart(5, "0")}`;
      if (!usedSuggestions.has(fallback)) {
        usedSuggestions.add(fallback);
        return fallback;
      }
      fallbackCounter += 1;
    }
    return "SAMPLE01";
  }

  const trimmed = base.slice(0, 8);
  if (!usedSuggestions.has(trimmed)) {
    usedSuggestions.add(trimmed);
    return trimmed;
  }

  for (let suffix = 1; suffix <= 99; suffix += 1) {
    const suffixText = String(suffix);
    const candidate = `${trimmed.slice(0, 8 - suffixText.length)}${suffixText}`;
    if (!usedSuggestions.has(candidate)) {
      usedSuggestions.add(candidate);
      return candidate;
    }
  }

  return trimmed;
}

function resolveBestSampleStems(mappings) {
  const resolved = new Map();
  const usedSuggestions = new Set();

  for (let index = 0; index < PAD_COUNT; index += 1) {
    const mapping = mappings.find((item) => item.index === index);
    const stem = mapping?.sampleStem || "";

    if (!stem) {
      resolved.set(index, "");
      continue;
    }

    const sanitized = sanitizeSampleName(path.parse(stem).name);
    const best = uniqueSuggestion(sanitized, usedSuggestions);
    resolved.set(index, best);
  }

  return resolved;
}

function writeFixedAscii(buffer, offset, length, value, padByte) {
  const fill = Buffer.alloc(length, padByte);
  const text = Buffer.from((value || "").slice(0, length), "ascii");
  text.copy(fill, 0, 0, Math.min(text.length, length));
  fill.copy(buffer, offset);
}

function calculateChecksum(buffer) {
  let sum = 0;
  for (let index = 9; index < buffer.length; index += 1) {
    sum = (sum + buffer[index]) & 0xff;
  }
  return sum;
}

function blockOffset(index, section = 1) {
  if (section === 1) {
    return HEADER_SIZE + index * BLOCK_SIZE;
  }
  return BLOCK2_START + index * BLOCK_SIZE;
}

function validateKitTemplate(buffer) {
  if (!buffer || buffer.length !== SAMPLEPAD4_FILE_SIZE) {
    throw new Error(`Expected SamplePad 4 .KIT size ${SAMPLEPAD4_FILE_SIZE}, got ${buffer?.length || 0}.`);
  }

  const magic = buffer.toString("ascii", 0, 4);
  if (magic !== HEADER_MAGIC) {
    throw new Error("Invalid KIT header. Not a SamplePad 4 template.");
  }

  for (let padIndex = 0; padIndex < PAD_COUNT; padIndex += 1) {
    const firstMagic = buffer.toString("ascii", blockOffset(padIndex, 1), blockOffset(padIndex, 1) + 4);
    const secondMagic = buffer.toString("ascii", blockOffset(padIndex, 2), blockOffset(padIndex, 2) + 4);

    if (firstMagic !== BLOCK_MAGIC || secondMagic !== BLOCK_MAGIC) {
      throw new Error(`Invalid block magic for pad index ${padIndex}.`);
    }
  }
}

function padMappingsFromKit(buffer) {
  const mappings = [];

  for (let index = 0; index < PAD_COUNT; index += 1) {
    const firstOffset = blockOffset(index, 1);
    const secondOffset = blockOffset(index, 2);

    const midiNote = buffer.readUInt8(firstOffset + MEMLOC.midiNote);
    const layerAFlag = buffer.readUInt8(secondOffset + MEMLOC.layerAFlag);
    const fileLength = buffer.readUInt8(secondOffset + MEMLOC.fileNameLengthA);

    const fileStem =
      layerAFlag === 0xaa
        ? readAsciiZeroTrim(buffer, secondOffset + MEMLOC.fileNameA, fileLength)
        : "";

    mappings.push({
      index,
      padLabel: PAD_LABELS[index],
      midiNote,
      sampleStem: fileStem,
    });
  }

  return mappings;
}

function applySampleToPad(buffer, padIndex, sampleStem) {
  const secondOffset = blockOffset(padIndex, 2);

  if (!sampleStem) {
    buffer[secondOffset + MEMLOC.layerAFlag] = 0xff;
    buffer[secondOffset + MEMLOC.layerAFlag + 1] = 0xff;
    buffer[secondOffset + MEMLOC.fileNameLengthA] = 0x00;
    writeFixedAscii(buffer, secondOffset + MEMLOC.displayNameA, 8, "", 0x20);
    writeFixedAscii(buffer, secondOffset + MEMLOC.fileNameA, 8, "", 0x00);
    return;
  }

  const sanitizedStem = sanitizeSampleName(path.parse(sampleStem).name);
  if (!sanitizedStem) {
    throw new Error(`Invalid sample name for pad ${padIndex + 1}. Use letters, numbers, or underscore.`);
  }

  buffer[secondOffset + MEMLOC.layerAFlag] = 0xaa;
  buffer[secondOffset + MEMLOC.layerAFlag + 1] = 0xaa;
  buffer[secondOffset + MEMLOC.velocityMinA] = 0x00;
  buffer[secondOffset + MEMLOC.velocityMaxA] = 0x7f;
  buffer[secondOffset + MEMLOC.fileNameLengthA] = sanitizedStem.length;

  writeFixedAscii(buffer, secondOffset + MEMLOC.displayNameA, 8, sanitizedStem.toUpperCase(), 0x20);
  writeFixedAscii(buffer, secondOffset + MEMLOC.fileNameA, 8, sanitizedStem, 0x00);
}

function writeMappingsToTemplate(sourceBuffer, mappings) {
  const buffer = Buffer.from(sourceBuffer);
  const resolvedStems = resolveBestSampleStems(mappings);

  for (let index = 0; index < PAD_COUNT; index += 1) {
    applySampleToPad(buffer, index, resolvedStems.get(index) || "");
  }

  buffer[8] = calculateChecksum(buffer);
  return buffer;
}

module.exports = {
  SAMPLEPAD4_FILE_SIZE,
  PAD_COUNT,
  PAD_LABELS,
  validateKitTemplate,
  padMappingsFromKit,
  writeMappingsToTemplate,
  sanitizeSampleName,
  resolveBestSampleStems,
};
