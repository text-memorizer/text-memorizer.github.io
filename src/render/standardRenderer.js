function renderStandardSide(card, index) {
  const sides = getStandardSides(card);
  const total = sides.length;
  const side = sides[index] || { markdown: "" };
  const wrap = document.createElement("div");
  wrap.className = "card-face card-side";
  const label = document.createElement("div");
  label.className = "card-side-label";
  label.textContent = `Side ${index + 1} of ${total}`;
  wrap.appendChild(label);
  wrap.appendChild(renderMarkdown(side.markdown));
  return wrap;
}

function renderStandardFront(card) {
  return renderStandardSide(card, 0);
}

function renderStandardBack(card) {
  const sides = getStandardSides(card);
  return renderStandardSide(card, sides.length - 1);
}
