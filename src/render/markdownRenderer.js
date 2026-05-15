function renderMarkdown(rawMarkdown) {
  if (!rawMarkdown) return document.createElement("div");

  const unsafeHtml = marked.parse(rawMarkdown);

  // Allow data:image/* and data:audio/* URIs so base64-embedded media renders.
  // Default DOMPurify rejects javascript:/vbscript:/data:text/html etc. — keep
  // the allow-list narrowed to image/audio data URLs only.
  const safeHtml = DOMPurify.sanitize(unsafeHtml, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ["audio", "source"],
    ADD_ATTR: ["controls", "src", "type"],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|data:image\/(?:png|jpeg|jpg|gif|webp|svg\+xml);base64,|data:audio\/(?:webm|ogg|mp3|mpeg|wav|m4a);base64,|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
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
