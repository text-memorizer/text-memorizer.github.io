function updateSchedule(card, rating) {
  const stats = card.cardStats;

  if (rating === "again") {
    stats.intervalDays = 0.25;
    stats.ease = Math.max(1.3, stats.ease - 0.3);
    stats.failedRecently = true;
    stats.failedReviews = (stats.failedReviews || 0) + 1;
  } else if (rating === "hard") {
    stats.intervalDays = Math.max(1, (stats.intervalDays || 0) * 1.2 || 1);
    stats.ease = Math.max(1.3, stats.ease - 0.15);
    stats.failedRecently = false;
    stats.successfulReviews = (stats.successfulReviews || 0) + 1;
  } else if (rating === "good") {
    stats.intervalDays = Math.max(1, (stats.intervalDays || 0) * stats.ease || 3);
    stats.failedRecently = false;
    stats.successfulReviews = (stats.successfulReviews || 0) + 1;
  } else if (rating === "easy") {
    stats.intervalDays = Math.max(3, (stats.intervalDays || 0) * stats.ease * 1.4 || 7);
    stats.ease += 0.1;
    stats.failedRecently = false;
    stats.successfulReviews = (stats.successfulReviews || 0) + 1;
  } else if (rating === "perfect") {
    stats.intervalDays = Math.max(7, (stats.intervalDays || 0) * stats.ease * 1.8 || 14);
    stats.ease += 0.15;
    stats.failedRecently = false;
    stats.successfulReviews = (stats.successfulReviews || 0) + 1;
  }

  stats.totalReviews = (stats.totalReviews || 0) + 1;
  stats.lastSeenAt = new Date().toISOString();
  stats.nextDueAt = addDays(new Date(), stats.intervalDays).toISOString();

  return card;
}

function cardPriority(card, nowMs) {
  const stats = card.cardStats;
  let score = 0;

  const dueTime = stats.nextDueAt ? new Date(stats.nextDueAt).getTime() : 0;

  if (dueTime <= nowMs) score += 100;

  const daysOverdue = Math.max(0, (nowMs - dueTime) / DAY_MS);
  score += daysOverdue * 8;

  if (stats.totalReviews === 0) score += 40;
  if (stats.failedRecently) score += 30;

  score += (1 - (stats.masteryPercent || 0)) * 20;

  return score;
}

function buildSessionQueue(cards, settings, nowMs) {
  const active = cards.filter(c => !c.deletedAt);
  const due = active.filter(c => isDue(c.cardStats.nextDueAt) && c.cardStats.totalReviews > 0);
  const difficult = active.filter(c => c.cardStats.failedRecently);
  const newCards = active.filter(c => c.cardStats.totalReviews === 0);

  due.sort((a, b) => cardPriority(b, nowMs) - cardPriority(a, nowMs));
  difficult.sort((a, b) => cardPriority(b, nowMs) - cardPriority(a, nowMs));

  const target = settings.targetCardCount || 20;
  const maxNew = settings.maxNewCards || 5;

  const seen = new Set();
  const queue = [];

  if (settings.includeDue !== false) {
    for (const c of due) {
      if (queue.length >= Math.floor(target * 0.7)) break;
      if (!seen.has(c.id)) { seen.add(c.id); queue.push(c); }
    }
  }

  if (settings.includeDifficult !== false) {
    for (const c of difficult) {
      if (queue.length >= Math.floor(target * 0.9)) break;
      if (!seen.has(c.id)) { seen.add(c.id); queue.push(c); }
    }
  }

  if (settings.includeNew !== false) {
    let added = 0;
    for (const c of newCards) {
      if (added >= maxNew || queue.length >= target) break;
      if (!seen.has(c.id)) { seen.add(c.id); queue.push(c); added++; }
    }
  }

  return queue;
}
