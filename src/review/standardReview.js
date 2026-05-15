// State machine: shows one side at a time. revealedCount starts at 1 (first side
// is visible immediately). Each "reveal" increments. Once revealedCount equals
// the total sides, the rating phase starts.
const standardReviewState = {
  create(card) {
    const sides = getStandardSides(card);
    return {
      card,
      totalSides: Math.max(1, sides.length),
      revealedCount: 1,
      phase: sides.length <= 1 ? "revealed" : "hidden",
      startedAt: Date.now(),
      revealedAt: null
    };
  },

  reveal(state) {
    const next = Math.min(state.totalSides, state.revealedCount + 1);
    const phase = next >= state.totalSides ? "revealed" : "hidden";
    return {
      ...state,
      revealedCount: next,
      phase,
      revealedAt: phase === "revealed" ? Date.now() : state.revealedAt
    };
  },

  rate(state, rating) {
    return { ...state, phase: "rated", rating };
  }
};
