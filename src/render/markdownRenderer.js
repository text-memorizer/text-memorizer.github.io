function renderMarkdown(rawMarkdown) {
  if (!rawMarkdown) return document.createElement("div");

  const unsafeHtml = marked.parse(rawMarkdown);

  const safeHtml = DOMPurify.sanitize(unsafeHtml, {
    USE_PROFILES: { html: true }
  });

  const container = document.createElement("div");
  container.className = "markdown-body";
  container.innerHTML = safeHtml;

  renderMathInElement(container, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false }
    ],
    throwOnError: false
  });

  return container;
}
