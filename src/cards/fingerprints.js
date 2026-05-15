async function fingerprintStandard(sidesOrFront, maybeBack) {
  let sides;
  if (Array.isArray(sidesOrFront)) {
    sides = sidesOrFront.map(s => (typeof s === "string" ? s : ((s && s.markdown) || "")));
  } else {
    sides = [sidesOrFront || "", maybeBack || ""];
  }
  const normalized = sides.map(normalizeText).join("\n---\n");
  return sha256(normalized);
}

async function fingerprintTextMemory(text) {
  return sha256(normalizeText(text));
}
