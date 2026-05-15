async function saveImportedCards(db, parsedDecks, validCards) {
  // Ensure decks exist
  const deckIdMap = {};
  const existingDecks = await repo.getAllDecks(db);
  const deckByName = Object.fromEntries(existingDecks.map(d => [d.name, d]));

  const allDeckNames = new Set([
    ...parsedDecks.map(d => d.name),
    ...validCards.map(c => c.deck).filter(Boolean)
  ]);

  for (const deckName of allDeckNames) {
    if (deckByName[deckName]) {
      deckIdMap[deckName] = deckByName[deckName].id;
    } else {
      const parsedDeck = parsedDecks.find(d => d.name === deckName);
      let newDeck = createDeck({ name: deckName, tags: parsedDeck ? parsedDeck.tags : [] });
      if (cryptoIsUnlocked()) newDeck = await encryptDeck(newDeck);
      await repo.putDeck(db, newDeck);
      deckIdMap[deckName] = newDeck.id;
    }
  }

  let imported = 0;
  let skipped = 0;
  const skippedTitles = [];

  for (const rawCard of validCards) {
    const deckId = deckIdMap[rawCard.deck] || null;

    let fp;
    let sides = null;
    if (rawCard.type === "standard") {
      sides = Array.isArray(rawCard.sides) && rawCard.sides.length
        ? rawCard.sides.map(s => ({ markdown: (s && s.markdown) || "" }))
        : [
            { markdown: rawCard.frontMarkdown || rawCard.front || "" },
            { markdown: rawCard.backMarkdown || rawCard.back || "" }
          ];
      fp = await fingerprintStandard(sides);
    } else {
      fp = await fingerprintTextMemory(rawCard.text);
    }

    const existing = await repo.getCardByFingerprint(db, fp);
    if (existing) {
      skipped++;
      skippedTitles.push(rawCard.title || "Untitled");
      continue;
    }

    const titleFallback = rawCard.type === "standard"
      ? ((sides && sides[0] && sides[0].markdown) || "")
      : (rawCard.text || "");

    let newCard = createCard(rawCard.type, {
      title: rawCard.title || truncate(titleFallback, 8),
      deckId,
      tags: rawCard.tags || [],
      fingerprint: fp,
      sides,
      text: rawCard.text
    });

    if (cryptoIsUnlocked()) newCard = await encryptCardData(newCard);

    await repo.putCard(db, newCard);
    imported++;
  }

  return { imported, skipped, skippedTitles };
}
