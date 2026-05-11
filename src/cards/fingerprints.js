async function fingerprintStandard(frontMarkdown, backMarkdown) {
  const normalized = normalizeText(frontMarkdown) + "\n---\n" + normalizeText(backMarkdown);
  return sha256(normalized);
}

async function fingerprintTextMemory(text) {
  return sha256(normalizeText(text));
}
