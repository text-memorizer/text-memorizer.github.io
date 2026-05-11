function normalizeText(str) {
  return (str || "")
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .toLowerCase();
}

function truncate(str, maxWords) {
  const words = (str || "").trim().split(/\s+/);
  return words.slice(0, maxWords).join(" ");
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
