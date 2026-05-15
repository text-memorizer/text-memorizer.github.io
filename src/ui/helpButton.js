// Small "?" button that opens the Help screen scrolled to a specific topic.
// Use: helpButton(db, "card-cloze")

function helpButton(db, topicId) {
  return el("button", {
    type: "button",
    className: "btn btn--ghost help-button",
    title: "Open help",
    "aria-label": "Open help",
    onClick: () => {
      setScreen("help");
      renderHelpScreen(db, { anchor: topicId });
    }
  }, "?");
}
