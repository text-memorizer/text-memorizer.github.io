function renderMasteryBar(masteryPercent) {
  const pct = Math.round((masteryPercent || 0) * 100);
  const bar = document.createElement("div");
  bar.className = "mastery-bar";
  bar.innerHTML = `<div class="mastery-fill" style="width:${pct}%"></div>`;
  bar.title = `Mastery: ${pct}%`;
  return bar;
}

function renderDueChip(card) {
  const chip = document.createElement("span");
  chip.className = "due-chip";
  if (!card.cardStats.lastSeenAt) {
    chip.className += " due-chip--new";
    chip.textContent = "New";
  } else if (isDue(card.cardStats.nextDueAt)) {
    chip.className += " due-chip--due";
    chip.textContent = "Due";
  } else {
    chip.className += " due-chip--later";
    chip.textContent = formatRelative(card.cardStats.nextDueAt);
  }
  return chip;
}
