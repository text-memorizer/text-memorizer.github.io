const RECOGNIZED_CARD_FIELDS = new Set([
  "type", "title", "deck", "tags", "front", "back", "text", "notes", "source", "difficulty"
]);

function isRecognizedField(name) {
  if (RECOGNIZED_CARD_FIELDS.has(name)) return true;
  return /^side\d+$/.test(name);
}

function parseMarkdownDeck(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let deckName = "Imported Deck";
  let deckTags = [];
  let deckType = "standard";

  const rawCards = [];
  let currentCard = null;
  let currentField = null;
  let currentFieldLines = [];

  function flushField() {
    if (currentField && currentCard) {
      currentCard[currentField] = currentFieldLines.join("\n").trim();
    }
    currentField = null;
    currentFieldLines = [];
  }

  function flushCard() {
    flushField();
    if (currentCard && Object.keys(currentCard).length > 0) {
      rawCards.push(currentCard);
    }
    currentCard = null;
  }

  let inHeader = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim() === "---") {
      if (inHeader) {
        inHeader = false;
        currentCard = {};
      } else {
        flushCard();
        currentCard = {};
      }
      continue;
    }

    // Parse deck-level header fields (before first ---)
    if (inHeader) {
      const deckMatch = line.match(/^#\s+Deck:\s*(.+)$/i);
      if (deckMatch) { deckName = deckMatch[1].trim(); continue; }

      const tagsMatch = line.match(/^Tags:\s*(.+)$/i);
      if (tagsMatch) { deckTags = tagsMatch[1].split(",").map(t => t.trim()).filter(Boolean); continue; }

      const typeMatch = line.match(/^Type:\s*(.+)$/i);
      if (typeMatch) { deckType = typeMatch[1].trim().toLowerCase(); continue; }
      continue;
    }

    if (!currentCard) continue;

    // Check for field name at start of line
    const fieldMatch = line.match(/^([A-Za-z][A-Za-z0-9 _-]*):\s*(.*)$/);
    if (fieldMatch) {
      const fieldName = fieldMatch[1].trim().toLowerCase().replace(/[ _-]/g, "");
      if (isRecognizedField(fieldName)) {
        flushField();
        currentField = fieldName;
        const rest = fieldMatch[2];
        currentFieldLines = rest ? [rest] : [];
        continue;
      }
    }

    // Continuation line
    if (currentField) {
      currentFieldLines.push(line);
    }
  }

  flushCard();

  // Build deck object
  const deck = { name: deckName, tags: deckTags };

  // Convert raw parsed cards into card objects
  const cards = rawCards.map((raw, i) => {
    const type = (raw.type || deckType).toLowerCase().replace(/_/g, "-");
    const tags = raw.tags
      ? raw.tags.split(",").map(t => t.trim()).filter(Boolean)
      : [...deckTags];

    const base = {
      type,
      title: raw.title || truncate(raw.front || raw.text || raw.side1 || "", 8),
      deck: raw.deck || deckName,
      tags,
      source: raw.source || "",
      notes: raw.notes || ""
    };

    if (type === "text-memory") {
      base.text = raw.text || "";
    } else {
      const sideKeys = Object.keys(raw)
        .filter(k => /^side\d+$/.test(k))
        .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));
      if (sideKeys.length > 0) {
        base.sides = sideKeys.map(k => ({ markdown: raw[k] || "" }));
      } else {
        base.sides = [
          { markdown: raw.front || "" },
          { markdown: raw.back || "" }
        ];
      }
    }

    return base;
  });

  return { deck, cards };
}
