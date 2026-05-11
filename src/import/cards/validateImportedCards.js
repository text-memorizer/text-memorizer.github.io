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
      if (!card.frontMarkdown && !card.front) {
        errors.push({ index: i, card, message: `${label}: standard card missing Front` });
        continue;
      }
      if (!card.backMarkdown && !card.back) {
        errors.push({ index: i, card, message: `${label}: standard card missing Back` });
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
