const reviewController = {
  session: null,

  async startSession(db, deckId, settings = {}) {
    const allCards = deckId
      ? await repo.getCardsByDeck(db, deckId)
      : await repo.getAllCards(db);

    const sessionSettings = {
      targetCardCount: 20,
      maxNewCards: 5,
      includeDue: true,
      includeDifficult: true,
      includeNew: true,
      repeatFailedCards: true,
      ...settings
    };

    const queue = buildSessionQueue(allCards, sessionSettings, Date.now());

    if (!queue.length) return null;

    const sessionId = generateId("session");
    const ts = now();
    const sessionRecord = {
      id: sessionId,
      startedAt: ts,
      endedAt: null,
      deckId: deckId || null,
      targetCardCount: sessionSettings.targetCardCount,
      cardsReviewed: [],
      reviewQueue: queue.map(c => c.id),
      settings: sessionSettings,
      createdAt: ts,
      updatedAt: ts,
      modifiedByDeviceId: getOrCreateDeviceId()
    };

    await repo.putSession(db, sessionRecord);

    this.session = {
      db,
      sessionId,
      queue: [...queue],
      index: 0,
      failedCards: [],
      record: sessionRecord
    };

    return this.session;
  },

  currentCard() {
    if (!this.session) return null;
    const { queue, index, failedCards } = this.session;
    if (index < queue.length) return queue[index];
    // Repeat failed cards at the end
    if (failedCards.length) return failedCards.shift();
    return null;
  },

  async submitRating(rating) {
    if (!this.session) return;
    const { db, sessionId } = this.session;
    const card = this.currentCard();
    if (!card) return;

    const previousInterval = card.cardStats.intervalDays;
    const previousDue = card.cardStats.nextDueAt;

    updateSchedule(card, rating);

    const masteryDelta = computeMasteryDelta(card, rating);
    card.cardStats.masteryPercent = Math.min(1, Math.max(0, (card.cardStats.masteryPercent || 0) + masteryDelta));

    await repo.putCard(db, card);

    const reviewId = generateId("review");
    const reviewRecord = {
      id: reviewId,
      cardId: card.id,
      cardType: card.type,
      sessionId,
      reviewedAt: now(),
      userRating: rating,
      interactionStats: { totalTimeMs: 0 },
      result: {
        previousIntervalDays: previousInterval,
        newIntervalDays: card.cardStats.intervalDays,
        previousNextDueAt: previousDue,
        nextDueAt: card.cardStats.nextDueAt,
        masteryDelta
      },
      createdAt: now(),
      modifiedByDeviceId: getOrCreateDeviceId()
    };

    await repo.putReview(db, reviewRecord);

    // Track failed cards for repeat
    if (rating === "again" && this.session.record.settings.repeatFailedCards) {
      this.session.failedCards.push(card);
    }

    this.session.record.cardsReviewed.push(card.id);
    this.session.record.updatedAt = now();
    await repo.putSession(db, this.session.record);

    this.session.index++;
  },

  async endSession() {
    if (!this.session) return;
    this.session.record.endedAt = now();
    this.session.record.updatedAt = now();
    await repo.putSession(this.session.db, this.session.record);
    this.session = null;
  },

  isComplete() {
    if (!this.session) return true;
    return !this.currentCard();
  }
};

function computeMasteryDelta(card, rating) {
  const deltas = { again: -0.1, hard: 0.02, good: 0.06, easy: 0.1, perfect: 0.15 };
  return deltas[rating] || 0;
}
