function renderStandardFront(card) {
  const wrap = document.createElement("div");
  wrap.className = "card-face card-front";
  wrap.appendChild(renderMarkdown(card.standardCard.frontMarkdown));
  return wrap;
}

function renderStandardBack(card) {
  const wrap = document.createElement("div");
  wrap.className = "card-face card-back";
  wrap.appendChild(renderMarkdown(card.standardCard.backMarkdown));
  return wrap;
}
