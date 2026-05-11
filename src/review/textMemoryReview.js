// Phases: recall -> revealed -> rating -> blinding -> done
const textMemoryReview = {
  create(card) {
    return {
      card,
      phase: "recall",
      startedAt: Date.now(),
      revealedAt: null,
      // Sets of word indices for this review session only
      tempRevealed: new Set(),
      clickedThisReview: new Set(),
      rating: null,
      suggestedTokens: null,
      customizing: false
    };
  },

  clickWord(state, wordIndex) {
    const newRevealed = new Set(state.tempRevealed);
    const newClicked = new Set(state.clickedThisReview);
    newRevealed.add(wordIndex);
    newClicked.add(wordIndex);
    return { ...state, tempRevealed: newRevealed, clickedThisReview: newClicked };
  },

  showFullText(state) {
    return { ...state, phase: "revealed", revealedAt: Date.now() };
  },

  rate(state, rating) {
    // Deep-clone tokens for suggestion
    const tokens = JSON.parse(JSON.stringify(state.card.textMemoryCard.tokens));
    const clickedList = Array.from(state.clickedThisReview);
    const suggested = suggestBlinding(tokens, rating, clickedList);
    return { ...state, phase: "blinding", rating, suggestedTokens: suggested };
  },

  acceptBlinding(state) {
    return { ...state, phase: "done" };
  },

  makeEasier(state) {
    // Unblind one more word (promote one blind -> letter, letter -> full)
    const tokens = JSON.parse(JSON.stringify(state.suggestedTokens));
    const blind = tokens.filter(t => t.type === "word" && t.visibleMode === "blind");
    if (blind.length) blind[0].visibleMode = "letter";
    else {
      const letter = tokens.filter(t => t.type === "word" && t.visibleMode === "letter");
      if (letter.length) letter[0].visibleMode = "full";
    }
    return { ...state, suggestedTokens: tokens };
  },

  makeHarder(state) {
    // Blind one more word
    const tokens = JSON.parse(JSON.stringify(state.suggestedTokens));
    const candidates = tokens
      .filter(t => t.type === "word" && t.visibleMode !== "blind" && t.visibleMode !== "locked")
      .sort((a, b) => (b.mastery || 0) - (a.mastery || 0));
    if (candidates.length) {
      const word = candidates[0];
      word.visibleMode = word.visibleMode === "full" ? "letter" : "blind";
    }
    return { ...state, suggestedTokens: tokens };
  },

  startCustomizing(state) {
    return { ...state, customizing: true };
  },

  cycleWord(state, wordIndex) {
    // Cycle: full -> letter -> blind -> full
    const tokens = state.suggestedTokens.map(t => {
      if (t.type !== "word" || t.index !== wordIndex) return t;
      const cycle = { full: "letter", letter: "blind", blind: "full" };
      return { ...t, visibleMode: cycle[t.visibleMode] || "full" };
    });
    return { ...state, suggestedTokens: tokens };
  }
};
