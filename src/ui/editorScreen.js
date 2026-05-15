async function renderEditorScreen(db, existingCard, deckId) {
  const screen = document.getElementById("screen-editor");
  screen.innerHTML = "";

  if (existingCard && (existingCard.standardCard?.encrypted || existingCard.textMemoryCard?.encrypted || existingCard.clozeCard?.encrypted)) {
    existingCard = await decryptCardData(existingCard);
    if (!existingCard) { showToast("Cannot decrypt card — vault may be locked.", "error"); return; }
  }

  let decks = (await repo.getAllDecks(db)).filter(d => !d.deletedAt);
  if (cryptoIsUnlocked()) decks = (await Promise.all(decks.map(decryptDeck))).filter(Boolean);
  const isNew = !existingCard;
  const cardType = existingCard ? existingCard.type : "standard";
  let isDirty = false;
  let currentFieldType = cardType;

  // Pre-fetch the linked reverse companion (if any) so the editor can surface
  // the existing link rather than letting the user accidentally create a
  // duplicate by re-saving with the checkbox unchecked or freshly checked.
  let linkedReverse = null;
  let linkedReverseTitle = "";
  if (existingCard) {
    linkedReverse = await findLinkedReverseCard(db, existingCard);
    if (linkedReverse) {
      let decLinked = linkedReverse;
      if (cryptoIsUnlocked() &&
          (linkedReverse.standardCard?.encrypted || linkedReverse.textMemoryCard?.encrypted || linkedReverse.clozeCard?.encrypted)) {
        decLinked = await decryptCardData(linkedReverse);
      }
      linkedReverseTitle = (decLinked && decLinked.title) || "Untitled";
    }
  }
  const hasExistingCompanion = !!(existingCard && existingCard.hasReverseCompanion && linkedReverse);
  const isReverseCompanion = !!(existingCard && existingCard.reverseOfCardId);

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
      el("option", { value: "text-memory", ...(cardType === "text-memory" ? { selected: "selected" } : {}) }, "Text Memorization"),
      el("option", { value: "cloze", ...(cardType === "cloze" ? { selected: "selected" } : {}) }, "Cloze Deletion")
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

  // Reverse companion option (only for standard cards)
  const reverseCheckboxAttrs = { type: "checkbox", id: "editor-reverse-companion" };
  if (hasExistingCompanion || isReverseCompanion) {
    reverseCheckboxAttrs.checked = true;
    reverseCheckboxAttrs.disabled = true;
  }
  let reverseHintText;
  if (isReverseCompanion) {
    const sourceTitle = linkedReverseTitle || "the original card";
    reverseHintText = `This is the reverse of "${sourceTitle}". Edit the original separately to update it.`;
  } else if (hasExistingCompanion) {
    reverseHintText = "Linked reverse companion exists. Edit the companion separately to update it.";
  } else {
    reverseHintText = "Sides will appear in reverse order on the companion.";
  }
  const reverseCompanionRow = el("div", { className: "form-row", id: "editor-reverse-companion-row" },
    el("label", { className: "checkbox-row" },
      el("input", reverseCheckboxAttrs),
      el("span", {}, "Also create reverse companion")
    ),
    el("div", { className: "form-help" }, reverseHintText)
  );
  form.appendChild(reverseCompanionRow);

  // Working copy of side markdowns when editing a standard card. Survives
  // re-renders inside renderStandardFields (e.g., add/remove side).
  let editorSides = null;

  function collectSideValues() {
    if (!editorSides) return null;
    const collected = [];
    for (let i = 0; i < editorSides.length; i++) {
      const ta = document.getElementById(`editor-side-${i}`);
      collected.push({ markdown: ta ? ta.value : (editorSides[i].markdown || "") });
    }
    return collected;
  }

  function updateEditorFields(skipCheck = false) {
    const type = document.getElementById("editor-type").value;

    if (!skipCheck && type !== currentFieldType) {
      const textEl = document.getElementById("editor-text");
      const clozeEl = document.getElementById("editor-cloze-text");
      let hasContent = (textEl && textEl.value.trim()) || (clozeEl && clozeEl.value.trim());
      if (!hasContent && editorSides) {
        const vals = collectSideValues() || [];
        hasContent = vals.some(s => (s.markdown || "").trim());
      }

      if (hasContent) {
        document.getElementById("editor-type").value = currentFieldType;
        confirmModal(
          "Switching card type will clear the current content. Continue?",
          () => {
            document.getElementById("editor-type").value = type;
            currentFieldType = type;
            isDirty = false;
            editorSides = null;
            fieldsContainer.innerHTML = "";
            if (type === "standard") renderStandardFields(null);
            else if (type === "cloze") renderClozeFields(null);
            else renderTextMemoryFields(null);
            reverseCompanionRow.style.display = type === "standard" ? "" : "none";
          }
        );
        return;
      }
    }

    currentFieldType = type;
    fieldsContainer.innerHTML = "";
    if (type === "standard") renderStandardFields(existingCard);
    else if (type === "cloze") { editorSides = null; renderClozeFields(existingCard); }
    else { editorSides = null; renderTextMemoryFields(existingCard); }
    reverseCompanionRow.style.display = type === "standard" ? "" : "none";
  }

  function renderStandardFields(card) {
    if (!editorSides) {
      if (card) {
        const existing = getStandardSides(card);
        editorSides = existing.length ? existing : [{ markdown: "" }, { markdown: "" }];
      } else {
        editorSides = [{ markdown: "" }, { markdown: "" }];
      }
    }

    const sidesWrap = el("div", { className: "sides-wrap" });
    fieldsContainer.appendChild(sidesWrap);

    function snapshotIntoState() {
      const vals = collectSideValues();
      if (vals) editorSides = vals;
    }

    function rerender() {
      fieldsContainer.innerHTML = "";
      renderStandardFields(card);
    }

    for (let i = 0; i < editorSides.length; i++) {
      const sideIdx = i;
      const sideValue = editorSides[i].markdown || "";

      const labelRow = el("div", { className: "side-label-row" },
        el("label", { className: "form-label" }, `Side ${sideIdx + 1}`),
        el("div", { className: "side-actions" },
          el("button", { type: "button", className: "btn btn--sm",
            onClick: () => {
              snapshotIntoState();
              if (sideIdx > 0) {
                [editorSides[sideIdx - 1], editorSides[sideIdx]] = [editorSides[sideIdx], editorSides[sideIdx - 1]];
                isDirty = true;
                rerender();
              }
            }
          }, "↑"),
          el("button", { type: "button", className: "btn btn--sm",
            onClick: () => {
              snapshotIntoState();
              if (sideIdx < editorSides.length - 1) {
                [editorSides[sideIdx + 1], editorSides[sideIdx]] = [editorSides[sideIdx], editorSides[sideIdx + 1]];
                isDirty = true;
                rerender();
              }
            }
          }, "↓"),
          el("button", { type: "button", className: "btn btn--sm btn--danger-ghost",
            onClick: () => {
              if (editorSides.length <= 1) {
                showToast("A card must have at least one side.", "error");
                return;
              }
              snapshotIntoState();
              editorSides.splice(sideIdx, 1);
              isDirty = true;
              rerender();
            }
          }, "Remove")
        )
      );

      const textarea = el("textarea", {
        className: "form-textarea", id: `editor-side-${sideIdx}`,
        placeholder: "Markdown and $math$ supported. Paste or drop images to insert as base64.",
        rows: "4"
      }, sideValue);

      const fileInput = el("input", {
        type: "file", accept: "image/*", multiple: "multiple",
        style: "display:none", id: `editor-side-file-${sideIdx}`
      });
      fileInput.addEventListener("change", async (e) => {
        await handleImageFiles(textarea, Array.from(e.target.files || []));
        e.target.value = "";
        isDirty = true;
      });

      const audioInput = el("input", {
        type: "file", accept: "audio/*",
        style: "display:none", id: `editor-side-audio-${sideIdx}`
      });
      audioInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) {
          await handleAudioFile(textarea, files[0]);
          isDirty = true;
        }
        e.target.value = "";
      });

      const imageBtn = el("button", { type: "button", className: "btn btn--sm",
        onClick: () => fileInput.click() }, "+ Image");
      const audioBtn = el("button", { type: "button", className: "btn btn--sm",
        onClick: () => audioInput.click() }, "+ Audio");
      const recordBtn = el("button", { type: "button", className: "btn btn--sm",
        onClick: () => openAudioRecorderModal(textarea, () => { isDirty = true; }) }, "Record");

      const mediaBtnRow = el("div", { className: "media-btn-row" }, imageBtn, audioBtn, recordBtn);

      textarea.addEventListener("paste", async (e) => {
        const items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        const files = [];
        for (const item of items) {
          if (item.kind === "file" && item.type.startsWith("image/")) {
            const f = item.getAsFile();
            if (f) files.push(f);
          }
        }
        if (files.length) {
          e.preventDefault();
          await handleImageFiles(textarea, files);
          isDirty = true;
        }
      });

      textarea.addEventListener("dragover", (e) => { e.preventDefault(); textarea.classList.add("drop-target"); });
      textarea.addEventListener("dragleave", () => textarea.classList.remove("drop-target"));
      textarea.addEventListener("drop", async (e) => {
        e.preventDefault();
        textarea.classList.remove("drop-target");
        const files = Array.from(e.dataTransfer?.files || []).filter(f => f.type.startsWith("image/"));
        if (files.length) {
          await handleImageFiles(textarea, files);
          isDirty = true;
        }
      });

      const previewEl = el("div", { className: "md-preview" });
      function updatePreview() {
        previewEl.innerHTML = "";
        previewEl.appendChild(renderMarkdown(textarea.value));
      }
      textarea.addEventListener("input", () => {
        editorSides[sideIdx].markdown = textarea.value;
        updatePreview();
      });
      updatePreview();

      const sideBox = el("div", { className: "side-box" },
        labelRow,
        el("div", { className: "side-editor-row" }, textarea, mediaBtnRow, fileInput, audioInput),
        el("div", { className: "form-row" },
          el("label", { className: "form-label form-label--small" }, "Preview"),
          previewEl
        )
      );
      sidesWrap.appendChild(sideBox);
    }

    const addBtn = el("button", { type: "button", className: "btn",
      onClick: () => {
        snapshotIntoState();
        editorSides.push({ markdown: "" });
        isDirty = true;
        rerender();
      }
    }, "+ Add Side");
    fieldsContainer.appendChild(addBtn);
  }

  function renderTextMemoryFields(card) {
    const text = card ? card.textMemoryCard.text : "";
    const textarea = el("textarea", { className: "form-textarea form-textarea--tall", id: "editor-text",
      placeholder: "Enter the passage to memorize", rows: "8" }, text);

    const imageInput = el("input", {
      type: "file", accept: "image/*", multiple: "multiple",
      style: "display:none", id: "editor-text-image"
    });
    imageInput.addEventListener("change", async (e) => {
      await handleImageFiles(textarea, Array.from(e.target.files || []));
      e.target.value = "";
      isDirty = true;
    });

    const audioInput = el("input", {
      type: "file", accept: "audio/*",
      style: "display:none", id: "editor-text-audio"
    });
    audioInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length) {
        await handleAudioFile(textarea, files[0]);
        isDirty = true;
      }
      e.target.value = "";
    });

    const imageBtn = el("button", { type: "button", className: "btn btn--sm",
      onClick: () => imageInput.click() }, "+ Image");
    const audioBtn = el("button", { type: "button", className: "btn btn--sm",
      onClick: () => audioInput.click() }, "+ Audio");
    const recordBtn = el("button", { type: "button", className: "btn btn--sm",
      onClick: () => openAudioRecorderModal(textarea, () => { isDirty = true; }) }, "Record");

    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Text"),
      textarea,
      el("div", { className: "media-btn-row" }, imageBtn, audioBtn, recordBtn),
      imageInput,
      audioInput
    ));

    const tokenPreview = el("div", { className: "token-preview" });
    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Token Preview"),
      tokenPreview
    ));

    function updateTokenPreview() {
      const txt = textarea.value;
      const tokens = tokenize(txt);
      tokenPreview.innerHTML = "";
      tokenPreview.appendChild(renderTokens(tokens, { phase: "recall" }));
    }

    updateTokenPreview();
    textarea.addEventListener("input", updateTokenPreview);
  }

  function renderClozeFields(card) {
    const text = card && card.clozeCard ? card.clozeCard.text || "" : "";
    const textarea = el("textarea", {
      className: "form-textarea form-textarea--tall", id: "editor-cloze-text",
      placeholder: "Use {{c1::content}} or {{c1::content::hint}} to mark cloze deletions. Multiple groups are independent review entries.",
      rows: "8"
    }, text);

    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Source Text"),
      textarea,
      el("div", { className: "form-help" }, "Example: The capital of {{c1::France}} is {{c2::Paris::city}}.")
    ));

    const groupsPanel = el("div", { className: "cloze-groups-panel" });
    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label" }, "Cloze Groups"),
      groupsPanel
    ));

    const previewEl = el("div", { className: "md-preview" });
    fieldsContainer.appendChild(el("div", { className: "form-row" },
      el("label", { className: "form-label form-label--small" }, "Preview (back side)"),
      previewEl
    ));

    function updateClozePreview() {
      const txt = textarea.value;
      const { groups } = parseCloze(txt);
      const keys = Array.from(groups.keys()).sort((a, b) =>
        parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));

      groupsPanel.innerHTML = "";
      if (!keys.length) {
        groupsPanel.appendChild(el("div", { className: "cloze-groups-empty" },
          "No cloze groups detected. Wrap text in {{c1::...}} to create one."));
      } else {
        groupsPanel.appendChild(el("div", { className: "cloze-groups-count" },
          `${keys.length} cloze group${keys.length === 1 ? "" : "s"} detected:`));
        const list = el("ul", { className: "cloze-groups-list" });
        for (const key of keys) {
          const g = groups.get(key);
          const raw = g.content || "";
          const previewText = raw.length > 60 ? raw.slice(0, 60) + "…" : raw;
          const hintSuffix = g.hint !== undefined ? ` — hint: "${g.hint}"` : "";
          list.appendChild(el("li", {},
            el("strong", {}, key),
            ": ",
            previewText,
            hintSuffix
          ));
        }
        groupsPanel.appendChild(list);
      }

      // Preview the fully-revealed back text
      previewEl.innerHTML = "";
      let backText = "";
      const { segments } = parseCloze(txt);
      for (const seg of segments) {
        if (seg.type === "text") backText += seg.value;
        else backText += seg.value;
      }
      previewEl.appendChild(renderMarkdown(backText));
    }

    textarea.addEventListener("input", updateClozePreview);
    updateClozePreview();
  }

  // Save button
  const saveBtn = el("button", { className: "btn btn--primary btn--lg",
    onClick: () => saveCard(db, existingCard, collectSideValues) }, "Save Card");
  form.appendChild(saveBtn);

  // Must be in DOM before updateEditorFields — it uses getElementById internally
  screen.appendChild(form);

  updateEditorFields(true);

  // Track dirty state (after initial render so population doesn't mark form dirty)
  form.addEventListener("input", () => { isDirty = true; });
  form.addEventListener("change", () => { isDirty = true; });
}

async function saveCard(db, existingCard, collectSides) {
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
    const sides = (collectSides && collectSides()) || [];
    const filtered = sides.filter(s => (s.markdown || "").trim().length > 0);
    if (filtered.length < 2) {
      showToast("Standard cards need at least 2 non-empty sides.", "error");
      return;
    }
    fields.sides = sides.map(s => ({ markdown: s.markdown || "" }));
    fields.fingerprint = await fingerprintStandard(fields.sides);
  } else if (type === "cloze") {
    fields.text = document.getElementById("editor-cloze-text").value;
    const keys = clozeGroupKeys(fields.text);
    if (keys.length < 1) {
      showToast("Cloze cards need at least 1 cloze group (e.g. {{c1::...}}).", "error");
      return;
    }
    // Preserve groupStats for unchanged groups; reset for new ones.
    const existingStats = existingCard && existingCard.clozeCard
      ? (existingCard.clozeCard.groupStats || {})
      : {};
    fields.groupStats = {};
    for (const k of keys) {
      fields.groupStats[k] = existingStats[k] || buildCardStats();
    }
    fields.fingerprint = await fingerprintCloze(fields.text);
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

  const companionCheckbox = document.getElementById("editor-reverse-companion");
  // Skip companion creation when the checkbox is disabled (the link already
  // exists in one direction). Only honor the checkbox for first-time creation.
  const wantsCompanion = type === "standard"
    && companionCheckbox
    && companionCheckbox.checked
    && !companionCheckbox.disabled;

  let savedCardId;
  if (existingCard) {
    let updated;
    if (type === "standard") {
      updated = updateCard(existingCard, {
        title: fields.title, deckId: fields.deckId, tags: fields.tags, fingerprint: fields.fingerprint,
        type: "standard",
        standardCard: { sides: fields.sides },
        textMemoryCard: existingCard.type === "standard" ? existingCard.textMemoryCard : null,
        clozeCard: existingCard.type === "standard" ? existingCard.clozeCard : null
      });
    } else if (type === "cloze") {
      updated = updateCard(existingCard, {
        title: fields.title, deckId: fields.deckId, tags: fields.tags, fingerprint: fields.fingerprint,
        type: "cloze",
        clozeCard: { text: fields.text, groupStats: fields.groupStats },
        standardCard: existingCard.type === "cloze" ? existingCard.standardCard : null,
        textMemoryCard: existingCard.type === "cloze" ? existingCard.textMemoryCard : null
      });
      refreshClozeAggregate(updated);
    } else {
      updated = updateCard(existingCard, {
        title: fields.title, deckId: fields.deckId, tags: fields.tags, fingerprint: fields.fingerprint,
        type: "text-memory",
        textMemoryCard: { text: fields.text, preserveLineBreaks: true, tokens: fields.tokens },
        standardCard: existingCard.type === "text-memory" ? existingCard.standardCard : null,
        clozeCard: existingCard.type === "text-memory" ? existingCard.clozeCard : null
      });
    }
    if (wantsCompanion) updated.hasReverseCompanion = true;
    savedCardId = updated.id;
    if (cryptoIsUnlocked()) updated = await encryptCardData(updated);
    await repo.putCard(db, updated);
    showToast("Card updated.");
  } else {
    let newCard = createCard(type, fields);
    if (wantsCompanion) newCard.hasReverseCompanion = true;
    savedCardId = newCard.id;
    if (cryptoIsUnlocked()) newCard = await encryptCardData(newCard);
    await repo.putCard(db, newCard);
    showToast("Card created.");
  }

  if (wantsCompanion) {
    const reversedSides = [...fields.sides].reverse();
    const reversedFingerprint = await fingerprintStandard(reversedSides);
    const companionTitle = fields.title ? `${fields.title} (reverse)` : "(reverse)";
    let companion = createCard("standard", {
      title: companionTitle,
      deckId: fields.deckId,
      tags: fields.tags,
      sides: reversedSides,
      fingerprint: reversedFingerprint,
      reverseOfCardId: savedCardId
    });
    if (cryptoIsUnlocked()) companion = await encryptCardData(companion);
    await repo.putCard(db, companion);
  }

  setScreen("library");
  renderLibraryScreen(db);
}
