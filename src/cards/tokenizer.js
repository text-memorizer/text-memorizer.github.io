function tokenize(text) {
  if (!text) return [];

  const tokens = [];
  let wordIndex = 0;

  // Split on word boundaries, preserving spaces, punctuation, and line breaks
  const parts = text.split(/(\r?\n|[^\w']+|[\w']+)/g).filter(p => p !== "");

  for (const part of parts) {
    if (part === "\n" || part === "\r\n") {
      tokens.push({ type: "linebreak", raw: "\n" });
    } else if (/^[\w']+$/.test(part)) {
      tokens.push({
        type: "word",
        index: wordIndex++,
        raw: part,
        normalized: part.toLowerCase(),
        prefix: part[0],
        visibleMode: "letter",
        mastery: 0,
        revealCount: 0,
        rightCount: 0,
        wrongCount: 0,
        lastClickedAt: null,
        lastChangedAt: null
      });
    } else if (/^\s+$/.test(part)) {
      tokens.push({ type: "space", raw: part });
    } else {
      tokens.push({ type: "punctuation", raw: part });
    }
  }

  return tokens;
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}
