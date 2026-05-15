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
      const textEl  = document.getElementById("editor-text");
      let hasContent = textEl && textEl.value.trim();
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
            else renderTextMemoryFields(null);
          }
        );
        return;
      }
    }

    currentFieldType = type;
    fieldsContainer.innerHTML = "";
    if (type === "standard") renderStandardFields(existingCard);
    else { editorSides = null; renderTextMemoryFields(existingCard); }
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

    function insertAtCursor(textarea, text) {
      const start = textarea.selectionStart ?? textarea.value.length;
      const end = textarea.selectionEnd ?? textarea.value.length;
      textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    async function fileToDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }

    async function handleImageFiles(textarea, files) {
      for (const f of files) {
        if (!f.type || !f.type.startsWith("image/")) continue;
        if (f.size > 5 * 1024 * 1024) {
          showToast(`Image "${f.name}" exceeds 5 MB and was skipped.`, "error");
          continue;
        }
        try {
          const dataUrl = await fileToDataUrl(f);
          const alt = (f.name || "image").replace(/[\[\]]/g, "");
          insertAtCursor(textarea, `\n\n![${alt}](${dataUrl})\n\n`);
        } catch {
          showToast(`Failed to read image "${f.name}".`, "error");
        }
      }
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

      const imageBtn = el("button", { type: "button", className: "btn btn--sm",
        onClick: () => fileInput.click() }, "+ Image");

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
        el("div", { className: "side-editor-row" }, textarea, imageBtn, fileInput),
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
        type: "standard",
        standardCard: { sides: fields.sides },
        textMemoryCard: existingCard.type === "standard" ? existingCard.textMemoryCard : null
      });
    } else {
      updated = updateCard(existingCard, {
        title: fields.title, deckId: fields.deckId, tags: fields.tags, fingerprint: fields.fingerprint,
        type: "text-memory",
        textMemoryCard: { text: fields.text, preserveLineBreaks: true, tokens: fields.tokens },
        standardCard: existingCard.type === "text-memory" ? existingCard.standardCard : null
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
