function renderMarkdown(rawMarkdown) {
  if (!rawMarkdown) return document.createElement("div");

  const unsafeHtml = marked.parse(rawMarkdown);

  // Allow data:image/* URIs so base64-embedded images render. Default DOMPurify
  // rejects javascript:/vbscript:/data:text/html etc. — narrow the allow-list
  // to data:image only.
  const safeHtml = DOMPurify.sanitize(unsafeHtml, {
    USE_PROFILES: { html: true },
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
  });

  const container = document.createElement("div");
  container.className = "markdown-body";
  container.innerHTML = safeHtml;

  container.querySelectorAll("img").forEach(img => {
    img.setAttribute("loading", "lazy");
    img.classList.add("md-image");
  });

  renderMathInElement(container, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false }
    ],
    throwOnError: false
  });

  return container;
}
