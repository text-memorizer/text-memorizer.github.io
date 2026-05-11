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
    if (rawCard.type === "standard") {
      fp = await fingerprintStandard(rawCard.frontMarkdown || rawCard.front, rawCard.backMarkdown || rawCard.back);
    } else {
      fp = await fingerprintTextMemory(rawCard.text);
    }

    const existing = await repo.getCardByFingerprint(db, fp);
    if (existing) {
      skipped++;
      skippedTitles.push(rawCard.title || "Untitled");
      continue;
    }

    const newCard = createCard(rawCard.type, {
      title: rawCard.title || truncate(rawCard.frontMarkdown || rawCard.text || "", 8),
      deckId,
      tags: rawCard.tags || [],
      fingerprint: fp,
      frontMarkdown: rawCard.frontMarkdown || rawCard.front,
      backMarkdown: rawCard.backMarkdown || rawCard.back,
      text: rawCard.text
    });

    if (cryptoIsUnlocked()) newCard = await encryptCardData(newCard);

    await repo.putCard(db, newCard);
    imported++;
  }

  return { imported, skipped, skippedTitles };
}
