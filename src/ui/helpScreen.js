// Help screen. Renders the topic list (left, sticky on desktop) and the topic
// content (right) using the existing renderMarkdown pipeline. Pass
// { anchor: "topic-id" } to scroll a specific topic into view on open.

function renderHelpScreen(db, opts) {
  const anchor = opts && opts.anchor;
  const screen = document.getElementById("screen-help");
  screen.innerHTML = "";

  const header = el("div", { className: "screen-header" },
    el("button", {
      className: "btn btn--ghost",
      onClick: () => { setScreen("library"); renderLibraryScreen(db); }
    }, "← Back"),
    el("h1", {}, "Help")
  );
  screen.appendChild(header);

  const layout = el("div", { className: "help-layout" });

  // ── Topic list (left / top on mobile) ──
  const toc = el("nav", { className: "help-toc", "aria-label": "Help topics" });
  for (const group of HELP_GROUPS) {
    const topicsInGroup = HELP_TOPICS.filter(t => t.group === group.id);
    if (!topicsInGroup.length) continue;
    toc.appendChild(el("div", { className: "help-toc-group" }, group.title));
    const ul = el("ul", { className: "help-toc-list" });
    for (const topic of topicsInGroup) {
      const a = el("a", {
        className: "help-toc-link",
        href: `#topic-${topic.id}`,
        onClick: (e) => {
          e.preventDefault();
          const target = document.getElementById(`topic-${topic.id}`);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
            _highlightActiveTocLink(toc, topic.id);
          }
        }
      }, topic.title);
      a.dataset.topicId = topic.id;
      ul.appendChild(el("li", {}, a));
    }
    toc.appendChild(ul);
  }
  layout.appendChild(toc);

  // ── Content (right / below on mobile) ──
  const content = el("div", { className: "help-content" });
  for (const topic of HELP_TOPICS) {
    const section = el("section", {
      className: "help-topic",
      id: `topic-${topic.id}`
    });
    section.appendChild(renderMarkdown(topic.markdown));
    content.appendChild(section);
  }
  layout.appendChild(content);

  screen.appendChild(layout);

  // Anchor scroll + active-link tracking after the DOM is in place.
  if (anchor) {
    const target = document.getElementById(`topic-${anchor}`);
    if (target) {
      // requestAnimationFrame so layout has settled (markdown + KaTeX done).
      requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
      _highlightActiveTocLink(toc, anchor);
    }
  } else {
    _highlightActiveTocLink(toc, HELP_TOPICS[0].id);
  }
}

function _highlightActiveTocLink(toc, topicId) {
  toc.querySelectorAll(".help-toc-link").forEach(a => {
    a.classList.toggle("help-toc-link--active", a.dataset.topicId === topicId);
  });
}
