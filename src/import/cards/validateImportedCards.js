function validateImportedCards(cards) {
  const valid = [];
  const errors = [];

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const label = card.title ? `"${card.title}"` : `Card ${i + 1}`;

    if (!card.type || !["standard", "text-memory"].includes(card.type)) {
      errors.push({ index: i, card, message: `${label}: unknown card type "${card.type}"` });
      continue;
    }

    if (card.type === "standard") {
      let sides = Array.isArray(card.sides) ? card.sides : null;
      if (!sides && (card.frontMarkdown || card.front || card.backMarkdown || card.back)) {
        sides = [
          { markdown: card.frontMarkdown || card.front || "" },
          { markdown: card.backMarkdown || card.back || "" }
        ];
        card.sides = sides;
      }
      const nonEmpty = (sides || []).filter(s => ((s && s.markdown) || "").trim().length > 0);
      if (nonEmpty.length < 2) {
        errors.push({ index: i, card, message: `${label}: standard card needs at least 2 non-empty sides` });
        continue;
      }
    }

    if (card.type === "text-memory") {
      if (!card.text) {
        errors.push({ index: i, card, message: `${label}: text-memory card missing Text` });
        continue;
      }
    }

    valid.push(card);
  }

  return { valid, errors };
}
