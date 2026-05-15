const reviewController = {
  session: null,

  async startSession(db, deckId, settings = {}) {
    const rawCards = deckId
      ? await repo.getCardsByDeck(db, deckId)
      : await repo.getAllCards(db);

    // Cloze cards keep groupStats inside the encrypted payload, so they must
    // be decrypted before we can decide which groups are due. Other card types
    // keep cardStats outside the payload, so they can stay encrypted in queue.
    const allCards = [];
    for (const c of rawCards) {
      if (c.type === "cloze" && c.clozeCard && c.clozeCard.encrypted && cryptoIsUnlocked()) {
        const dec = await decryptCardData(c);
        if (dec) allCards.push(dec);
      } else {
        allCards.push(c);
      }
    }

    const sessionSettings = {
      targetCardCount: 20,
      maxNewCards: 5,
      includeDue: true,
      includeDifficult: true,
      includeNew: true,
      repeatFailedCards: true,
      ...settings
    };

    const cardQueue = buildSessionQueue(allCards, sessionSettings, Date.now());

    // Expand cloze cards into one virtual entry per group that is due (or new).
    // Non-cloze entries are wrapped uniformly as { card } so the queue is
    // homogeneous internally. New cloze groups respect the session-wide
    // maxNewCards cap so a multi-group cloze can't silently flood the queue.
    const queue = [];
    const nowMs = Date.now();
    const maxNew = sessionSettings.maxNewCards;
    let newCount = 0;
    for (const card of cardQueue) {
      if (card.type === "cloze" && card.clozeCard && card.clozeCard.groupStats) {
        const keys = Object.keys(card.clozeCard.groupStats);
        for (const key of keys) {
          const stats = card.clozeCard.groupStats[key];
          const dueTime = stats && stats.nextDueAt ? new Date(stats.nextDueAt).getTime() : 0;
          const isNew = !stats || stats.totalReviews === 0;
          const isFailedRecently = stats && stats.failedRecently;
          if (isNew) {
            if (newCount >= maxNew) continue;
            newCount++;
            queue.push({ card, clozeGroup: key });
          } else if (dueTime <= nowMs || isFailedRecently) {
            queue.push({ card, clozeGroup: key });
          }
        }
      } else {
        queue.push({ card });
      }
    }

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
      reviewQueue: queue.map(e => e.clozeGroup ? `${e.card.id}::${e.clozeGroup}` : e.card.id),
      settings: sessionSettings,
      createdAt: ts,
      updatedAt: ts,
      modifiedByDeviceId: getOrCreateDeviceId()
    };

    await repo.putSession(db, sessionRecord);

    this.session = {
      db,
      sessionId,
      queue,
      index: 0,
      failedCards: [],
      record: sessionRecord,
      currentCardSurfacedAt: Date.now()
    };

    return this.session;
  },

  currentEntry() {
    if (!this.session) return null;
    const { queue, index, failedCards } = this.session;
    if (index < queue.length) return queue[index];
    if (failedCards.length) return failedCards[0];
    return null;
  },

  currentCard() {
    const entry = this.currentEntry();
    if (!entry) return null;
    if (entry.clozeGroup) {
      // Shallow-clone so activeClozeGroup doesn't leak onto the shared card,
      // which is reused across this card's other virtual entries.
      return { ...entry.card, activeClozeGroup: entry.clozeGroup };
    }
    return entry.card;
  },

  async submitRating(rating) {
    if (!this.session) return;
    const { db, sessionId } = this.session;
    const entry = this.currentEntry();
    if (!entry) return;

    // If we're consuming the failed-cards queue (past the main queue), shift
    // it now so subsequent currentEntry() returns the next failure.
    let fromFailedQueue = false;
    if (this.session.index >= this.session.queue.length && this.session.failedCards.length) {
      this.session.failedCards.shift();
      fromFailedQueue = true;
    }

    const card = entry.card;
    const clozeGroup = entry.clozeGroup || null;

    const surfacedAt = this.session.currentCardSurfacedAt || Date.now();
    const totalTimeMs = Math.max(0, Date.now() - surfacedAt);

    const statsForRating = clozeGroup
      ? card.clozeCard.groupStats[clozeGroup]
      : card.cardStats;

    const previousInterval = statsForRating.intervalDays;
    const previousDue = statsForRating.nextDueAt;

    updateSchedule(card, rating, clozeGroup);

    const masteryDelta = computeMasteryDelta(card, rating);
    if (clozeGroup) {
      const gs = card.clozeCard.groupStats[clozeGroup];
      gs.masteryPercent = Math.min(1, Math.max(0, (gs.masteryPercent || 0) + masteryDelta));
      refreshClozeAggregate(card);
    } else {
      card.cardStats.masteryPercent = Math.min(1, Math.max(0, (card.cardStats.masteryPercent || 0) + masteryDelta));
    }

    // For cloze cards, groupStats lives inside the encrypted payload, so we
    // must re-encrypt before saving. Other types keep cardStats outside the
    // payload and can be saved as-is.
    if (clozeGroup && cryptoIsUnlocked()) {
      const toSave = await encryptCardData(card);
      await repo.putCard(db, toSave);
    } else {
      await repo.putCard(db, card);
    }

    const newStats = clozeGroup
      ? card.clozeCard.groupStats[clozeGroup]
      : card.cardStats;

    const reviewId = generateId("review");
    const reviewRecord = {
      id: reviewId,
      cardId: card.id,
      cardType: card.type,
      clozeGroup,
      sessionId,
      reviewedAt: now(),
      userRating: rating,
      interactionStats: { totalTimeMs },
      result: {
        previousIntervalDays: previousInterval,
        newIntervalDays: newStats.intervalDays,
        previousNextDueAt: previousDue,
        nextDueAt: newStats.nextDueAt,
        masteryDelta
      },
      createdAt: now(),
      modifiedByDeviceId: getOrCreateDeviceId()
    };

    await repo.putReview(db, reviewRecord);

    if (rating === "again" && this.session.record.settings.repeatFailedCards) {
      this.session.failedCards.push(entry);
    }

    const reviewedLabel = clozeGroup ? `${card.id}::${clozeGroup}` : card.id;
    this.session.record.cardsReviewed.push(reviewedLabel);
    this.session.record.updatedAt = now();
    await repo.putSession(db, this.session.record);

    if (!fromFailedQueue) this.session.index++;
    this.session.currentCardSurfacedAt = Date.now();
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
    return !this.currentEntry();
  }
};

function computeMasteryDelta(card, rating) {
  const deltas = { again: -0.1, hard: 0.02, good: 0.06, easy: 0.1, perfect: 0.15 };
  return deltas[rating] || 0;
}
