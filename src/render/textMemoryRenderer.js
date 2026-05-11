function renderTokens(tokens, opts = {}) {
  const { tempRevealed = new Set(), phase = "recall", customizing = false, onWordClick } = opts;
  const container = document.createElement("div");
  container.className = "text-memory-body";

  for (const token of tokens) {
    if (token.type === "linebreak") {
      container.appendChild(document.createElement("br"));
      continue;
    }

    if (token.type === "space") {
      container.appendChild(document.createTextNode(" "));
      continue;
    }

    if (token.type === "punctuation") {
      const span = document.createElement("span");
      span.className = "token-punct";
      span.textContent = token.raw;
      container.appendChild(span);
      continue;
    }

    // Word token
    const span = document.createElement("span");
    span.dataset.index = token.index;

    const isRevealed = tempRevealed.has(token.index) || phase === "revealed";
    const effectiveMode = isRevealed ? "full" : token.visibleMode;

    span.className = `token-word mode-${effectiveMode}`;
    if (isRevealed && token.visibleMode !== "full") span.className += " mode-temp-revealed";
    if (customizing) span.className += " mode-customizable";

    if (effectiveMode === "full") {
      span.textContent = token.raw;
    } else if (effectiveMode === "letter") {
      span.textContent = token.prefix;
      span.setAttribute("aria-label", token.raw);
    } else if (effectiveMode === "blind") {
      span.textContent = "_";
      span.setAttribute("aria-label", token.raw);
    } else if (effectiveMode === "locked") {
      span.textContent = token.raw;
      span.className += " mode-locked";
    }

    if (onWordClick && effectiveMode !== "full" && !customizing) {
      span.classList.add("clickable");
      span.addEventListener("click", () => onWordClick(token.index));
    }

    if (customizing) {
      span.classList.add("clickable");
      span.addEventListener("click", () => onWordClick && onWordClick(token.index));
    }

    container.appendChild(span);
  }

  return container;
}
