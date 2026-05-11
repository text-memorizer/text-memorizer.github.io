function updateWordMastery(word, rating, wasClicked) {
  const ratingDelta = {
    again: -0.15,
    hard: 0.02,
    good: 0.08,
    easy: 0.14,
    perfect: 0.22
  };

  let delta = ratingDelta[rating] || 0;

  if (wasClicked) {
    delta -= 0.18;
    word.revealCount = (word.revealCount || 0) + 1;
    word.lastClickedAt = new Date().toISOString();
  }

  word.mastery = clamp((word.mastery || 0) + delta, 0, 1);
}

function blindCandidateScore(word, tokens) {
  let score = (word.mastery || 0) * 100;

  if (word.revealCount > 0) score -= word.revealCount * 20;
  if (word.raw.length <= 3) score += 10;

  // Penalize first word of a line
  const idx = word.index;
  if (idx === 0) score -= 10;
  if (idx > 0) {
    const prev = tokens.slice(0, idx).reverse().find(t => t.type !== "space");
    if (prev && prev.type === "linebreak") score -= 10;
  }

  // Boost repeated words
  const normalized = word.normalized;
  const occurrences = tokens.filter(t => t.type === "word" && t.normalized === normalized).length;
  if (occurrences > 1) score += 8;

  return score;
}

// How many words to blind based on rating
const BLIND_COUNTS = {
  again: 0,
  hard: 0,
  good: 2,
  easy: 4,
  perfect: 8
};

function suggestBlinding(tokens, rating, clickedIndices = []) {
  const words = tokens.filter(t => t.type === "word");

  // First update mastery for all words
  for (const word of words) {
    const wasClicked = clickedIndices.includes(word.index);
    updateWordMastery(word, rating, wasClicked);
  }

  if (rating === "again") {
    // Demote clicked words and low-mastery words
    for (const word of words) {
      if (clickedIndices.includes(word.index) || word.mastery < 0.2) {
        if (word.visibleMode === "blind") word.visibleMode = "letter";
        else if (word.visibleMode === "letter") word.visibleMode = "full";
      }
    }
    return tokens;
  }

  const toBlind = BLIND_COUNTS[rating] || 0;
  if (toBlind === 0) return tokens;

  // Candidates: currently not blind or locked
  const candidates = words
    .filter(w => w.visibleMode !== "blind" && w.visibleMode !== "locked")
    .map(w => ({ word: w, score: blindCandidateScore(w, tokens) }))
    .sort((a, b) => b.score - a.score);

  const toPromote = candidates.slice(0, toBlind);
  for (const { word } of toPromote) {
    if (word.visibleMode === "full") word.visibleMode = "letter";
    else if (word.visibleMode === "letter") word.visibleMode = "blind";
  }

  return tokens;
}
