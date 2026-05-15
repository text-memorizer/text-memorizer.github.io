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
    cardStats: buildCardStats(),
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
    modifiedByDeviceId: getOrCreateDeviceId(),
    revision: 1
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

  return card;
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

function getOrCreateDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = "device_" + crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem("deviceId", id);
  }
  return id;
}
