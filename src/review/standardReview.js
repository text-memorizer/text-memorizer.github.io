// State machine: hidden -> revealed -> rated
const standardReviewState = {
  create(card) {
    return {
      card,
      phase: "hidden",
      startedAt: Date.now(),
      revealedAt: null
    };
  },

  reveal(state) {
    return { ...state, phase: "revealed", revealedAt: Date.now() };
  },

  rate(state, rating) {
    return { ...state, phase: "rated", rating };
  }
};
