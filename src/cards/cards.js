function buildCardStats() {
  return {
    totalReviews: 0,
    successfulReviews: 0,
    failedReviews: 0,
    lastSeenAt: null,
    nextDueAt: new Date().toISOString(),
    intervalDays: 0,
    ease: 2.5,
    masteryPercent: 0,
    failedRecently: false
  };
}

function createDeck(fields = {}) {
  const ts = now();
  return {
    id: generateId("deck"),
    name: fields.name || "New Deck",
    description: fields.description || "",
    tags: fields.tags || [],
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
    modifiedByDeviceId: getOrCreateDeviceId(),
    revision: 1
  };
}

function createCard(type, fields = {}) {
  const ts = now();
  const card = {
    id: generateId("card"),
    type,
    title: fields.title || "",
    deckId: fields.deckId || null,
    tags: fields.tags || [],
    fingerprint: fields.fingerprint || null,
    standardCard: null,
    textMemoryCard: null,
    clozeCard: null,
    cardStats: buildCardStats(),
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
    modifiedByDeviceId: getOrCreateDeviceId(),
    revision: 1,
    reverseOfCardId: fields.reverseOfCardId || null,
    hasReverseCompanion: fields.hasReverseCompanion === true
  };

  if (type === "standard") {
    let sides;
    if (Array.isArray(fields.sides) && fields.sides.length >= 1) {
      sides = fields.sides.map(s => ({ markdown: (s && s.markdown) || "" }));
    } else {
      sides = [
        { markdown: fields.frontMarkdown || "" },
        { markdown: fields.backMarkdown || "" }
      ];
    }
    if (sides.length < 2) sides.push({ markdown: "" });
    card.standardCard = { sides };
  }

  if (type === "text-memory") {
    card.textMemoryCard = {
      text: fields.text || "",
      preserveLineBreaks: fields.preserveLineBreaks !== false,
      tokens: fields.tokens || tokenize(fields.text || "")
    };
  }

  if (type === "cloze") {
    const text = fields.text || "";
    const keys = clozeGroupKeys(text);
    const groupStats = {};
    const incoming = fields.groupStats || {};
    for (const k of keys) {
      groupStats[k] = incoming[k] || buildCardStats();
    }
    card.clozeCard = { text, groupStats };
    refreshClozeAggregate(card);
  }

  return card;
}

// Aggregate per-group stats onto card.cardStats so the queue/library/etc. can
// treat a cloze card like any other when no group context is known.
// Aggregate mastery is the average across groups; nextDueAt is the earliest.
function refreshClozeAggregate(card) {
  if (card.type !== "cloze" || !card.clozeCard) return;
  const groups = card.clozeCard.groupStats || {};
  const keys = Object.keys(groups);
  if (!keys.length) {
    card.cardStats = buildCardStats();
    return;
  }
  let masterySum = 0;
  let totalReviews = 0;
  let successfulReviews = 0;
  let failedReviews = 0;
  let failedRecently = false;
  let earliestDue = Infinity;
  let lastSeenAt = null;
  for (const k of keys) {
    const g = groups[k] || buildCardStats();
    masterySum += g.masteryPercent || 0;
    totalReviews += g.totalReviews || 0;
    successfulReviews += g.successfulReviews || 0;
    failedReviews += g.failedReviews || 0;
    if (g.failedRecently) failedRecently = true;
    if (g.nextDueAt) {
      const t = new Date(g.nextDueAt).getTime();
      if (t < earliestDue) earliestDue = t;
    }
    if (g.lastSeenAt && (!lastSeenAt || g.lastSeenAt > lastSeenAt)) {
      lastSeenAt = g.lastSeenAt;
    }
  }
  card.cardStats = {
    totalReviews,
    successfulReviews,
    failedReviews,
    lastSeenAt,
    nextDueAt: earliestDue === Infinity ? new Date().toISOString() : new Date(earliestDue).toISOString(),
    intervalDays: null,
    ease: null,
    masteryPercent: masterySum / keys.length,
    failedRecently
  };
}

function updateCard(card, fields) {
  const updated = { ...card, ...fields, updatedAt: now(), revision: (card.revision || 1) + 1 };
  updated.modifiedByDeviceId = getOrCreateDeviceId();
  return updated;
}

function getStandardSides(card) {
  const sc = card && card.standardCard;
  if (!sc) return [];
  if (Array.isArray(sc.sides) && sc.sides.length > 0) {
    return sc.sides.map(s => ({ markdown: (s && s.markdown) || "" }));
  }
  return [
    { markdown: sc.frontMarkdown || "" },
    { markdown: sc.backMarkdown || "" }
  ];
}

async function findLinkedReverseCard(db, card) {
  if (card.reverseOfCardId) {
    const linked = await repo.getCard(db, card.reverseOfCardId);
    return linked && !linked.deletedAt ? linked : null;
  }
  if (card.hasReverseCompanion) {
    const all = await repo.getAllCards(db);
    return all.find(c => c.reverseOfCardId === card.id && !c.deletedAt) || null;
  }
  return null;
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = "device_" + crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem("deviceId", id);
  }
  return id;
}
