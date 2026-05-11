async function renderEditorScreen(db, existingCard, deckId) {
  const screen = document.getElementById("screen-editor");
  screen.innerHTML = "";

  if (existingCard && (existingCard.standardCard?.encrypted || existingCard.textMemoryCard?.encrypted)) {
    existingCard = await decryptCardData(existingCard);
    if (!existingCard) { showToast("Cannot decrypt card — vault may be locked.", "error"); return; }
  }

  let decks = (await repo.getAllDecks(db)).filter(d => !d.deletedAt);
  if (cryptoIsUnlocked()) decks = (await Promise.all(decks.map(decryptDeck))).filter(Boolean);
  const isNew = !existingCard;
  const cardType = existingCard ? existingCard.type : "standard";
  let isDirty = false;
  let currentFieldType = cardType;

  function navigateBack() {
    if (isDirty) {
      confirmModal("Discard unsaved changes?", () => {
        setScreen("library"); renderLibraryScreen(db);
      });
    } else {
      setScreen("library"); renderLibraryScreen(db);
    }
  }

  const header = el("div", { className: "screen-header" },
    el("button", { className: "btn btn--ghost", onClick: navigateBack }, "← Back"),
    el("h1", {}, isNew ? "New Card" : "Edit Card")
  );
  screen.appendChild(header);

  const form = el("div", { className: "editor-form" });

  // Type selector
  const typeRow = el("div", { className: "form-row" },
    el("label", { className: "form-label" }, "Card Type"),
    el("select", { className: "form-select", id: "editor-type", onChange: () => updateEditorFields() },
      el("option", { value: "standard", ...(cardType === "standard" ? { selected: "selected" } : {}) }, "Standard Flashcard"),
      el("option", { value: "text-memory", ...(cardType === "text-memory" ? { selected: "selected" } : {}) }, "Text Memorization")
    )
  );
  form.appendChild(typeRow);

  // Title
  const titleRow = el("div", { className: "form-row" },
    el("label", { className: "form-label" }, "Title"),
    el("input", { type: "text", className: "form-input", id: "editor-title",
      value: existingCard ? existingCard.title : "" })
  );
  form.appendChild(titleRow);

  // Deck selector
  const deckRow = el("div", { className: "form-row" },
    el("label", { className: "form-label" }, "Deck"),
    el("select", { className: "form-select", id: "editor-deck" },
      ...decks.map(d => {
        const opt = el("option", { value: d.id }, d.name);
        if (d.id === (existingCard ? existingCard.deckId : deckId)) opt.selected = true;
        return opt;
      }),
      el("option", { value: "__new__" }, "+ New Deck…")
    )
  );
  form.appendChild(deckRow);

  // Tags
  const tagsRow = el("div", { className: "form-row" },
    el("label", { className: "form-label" }, "Tags"),
    el("input", { type: "text", className: "form-input", id: "editor-tags",
      placeholder: "comma, separated",
      value: existingCard ? existingCard.tags.join(", ") : "" })
  );
  form.appendChild(tagsRow);

  // Card-type-specific fields container
  const fieldsContainer = el("div", { id: "editor-fields" });
  form.appendChild(fieldsContainer);

  function updateEditorFields(skipCheck = false) {
    const type = document.getElementById("editor-type").value;

    if (!skipCheck && type !== currentFieldType) {
      const frontEl = document.getElementById("editor-front");
      const backEl  = document.getElementById("editor-back");
      const textEl  = document.getElementById("editor-text");
      const hasContent =
        (frontEl && frontEl.value.trim()) ||
        (backEl  && backEl.value.trim())  ||
        (textEl  && textEl.value.trim());

      if (hasContent) {
        document.getElementById("editor-type").value = currentFieldType;
        confirmModal(
          "Switching card type will clear the current content. Continue?",
          () => {
            document.getElementById("editor-type").value = type;
            currentFieldType = type;
            isDirty = false;
            fieldsContainer.innerHTML = "";
            if (type === "standard") renderStandardFields(null);
            else renderTextMemoryFields(null);
          }
        );
        return;
      }
    }

    currentFieldType = type;
    fieldsContainer.innerHTML = "";
    if (type === "standard") renderStandardFields(existingCard);
    else renderTextMemoryFields(existingCard);
  }

  function renderStandardFields(card) {
    const front = card ? card.standardCard.frontMarkdown : "";
    const back = card ? card.standardCard.backMarkdown : "";

    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Front"),
      el("textarea", { className: "form-textarea", id: "editor-front",
        placeholder: "Markdown and $math$ supported", rows: "4" }, front)
    ));

    const previewFront = el("div", { className: "md-preview" });
    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Front Preview"),
      previewFront
    ));

    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Back"),
      el("textarea", { className: "form-textarea", id: "editor-back",
        placeholder: "Markdown and $math$ supported", rows: "4" }, back)
    ));

    const previewBack = el("div", { className: "md-preview" });
    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Back Preview"),
      previewBack
    ));

    function updatePreview() {
      const fv = document.getElementById("editor-front").value;
      const bv = document.getElementById("editor-back").value;
      previewFront.innerHTML = "";
      previewFront.appendChild(renderMarkdown(fv));
      previewBack.innerHTML = "";
      previewBack.appendChild(renderMarkdown(bv));
    }

    updatePreview();
    document.getElementById("editor-front").addEventListener("input", updatePreview);
    document.getElementById("editor-back").addEventListener("input", updatePreview);
  }

  function renderTextMemoryFields(card) {
    const text = card ? card.textMemoryCard.text : "";
    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Text"),
      el("textarea", { className: "form-textarea form-textarea--tall", id: "editor-text",
        placeholder: "Enter the passage to memorize", rows: "8" }, text)
    ));

    const tokenPreview = el("div", { className: "token-preview" });
    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Token Preview"),
      tokenPreview
    ));

    function updateTokenPreview() {
      const txt = document.getElementById("editor-text").value;
      const tokens = tokenize(txt);
      tokenPreview.innerHTML = "";
      tokenPreview.appendChild(renderTokens(tokens, { phase: "recall" }));
    }

    updateTokenPreview();
    document.getElementById("editor-text").addEventListener("input", updateTokenPreview);
  }

  // Save button
  const saveBtn = el("button", { className: "btn btn--primary btn--lg", onClick: () => saveCard(db, existingCard) }, "Save Card");
  form.appendChild(saveBtn);

  // Must be in DOM before updateEditorFields — it uses getElementById internally
  screen.appendChild(form);

  updateEditorFields(true);

  // Track dirty state (after initial render so population doesn't mark form dirty)
  form.addEventListener("input", () => { isDirty = true; });
  form.addEventListener("change", () => { isDirty = true; });
}

async function saveCard(db, existingCard) {
  const type = document.getElementById("editor-type").value;
  const title = document.getElementById("editor-title").value.trim();
  const tagsRaw = document.getElementById("editor-tags").value;
  const tags = tagsRaw.split(",").map(t => t.trim()).filter(Boolean);

  let deckId = document.getElementById("editor-deck").value;
  if (deckId === "__new__") {
    const deckName = prompt("New deck name:");
    if (!deckName) return;
    let newDeck = createDeck({ name: deckName.trim() });
    if (cryptoIsUnlocked()) newDeck = await encryptDeck(newDeck);
    await repo.putDeck(db, newDeck);
    deckId = newDeck.id;
  }

  let fields = { title, deckId, tags };

  if (type === "standard") {
    fields.frontMarkdown = document.getElementById("editor-front").value;
    fields.backMarkdown = document.getElementById("editor-back").value;
    fields.fingerprint = await fingerprintStandard(fields.frontMarkdown, fields.backMarkdown);
  } else {
    fields.text = document.getElementById("editor-text").value;
    if (existingCard && existingCard.textMemoryCard) {
      // Preserve existing token mastery if text unchanged
      const textChanged = existingCard.textMemoryCard.text !== fields.text;
      fields.tokens = textChanged ? tokenize(fields.text) : existingCard.textMemoryCard.tokens;
    } else {
      fields.tokens = tokenize(fields.text);
    }
    fields.fingerprint = await fingerprintTextMemory(fields.text);
  }

  if (existingCard) {
    let updated;
    if (type === "standard") {
      updated = updateCard(existingCard, {
        title: fields.title, deckId: fields.deckId, tags: fields.tags, fingerprint: fields.fingerprint,
        standardCard: { frontMarkdown: fields.frontMarkdown, backMarkdown: fields.backMarkdown }
      });
    } else {
      updated = updateCard(existingCard, {
        title: fields.title, deckId: fields.deckId, tags: fields.tags, fingerprint: fields.fingerprint,
        textMemoryCard: { text: fields.text, preserveLineBreaks: true, tokens: fields.tokens }
      });
    }
    if (cryptoIsUnlocked()) updated = await encryptCardData(updated);
    await repo.putCard(db, updated);
    showToast("Card updated.");
  } else {
    let newCard = createCard(type, fields);
    if (cryptoIsUnlocked()) newCard = await encryptCardData(newCard);
    await repo.putCard(db, newCard);
    showToast("Card created.");
  }

  setScreen("library");
  renderLibraryScreen(db);
}
