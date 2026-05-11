const DAY_MS = 86400000;

function addDays(date, days) {
  return new Date(new Date(date).getTime() + days * DAY_MS);
}

function now() {
  return new Date().toISOString();
}

function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(isoString) {
  if (!isoString) return "—";
  const diff = new Date(isoString).getTime() - Date.now();
  const absDiff = Math.abs(diff);
  const past = diff < 0;
  if (absDiff < 60000) return past ? "just now" : "in a moment";
  if (absDiff < 3600000) {
    const m = Math.round(absDiff / 60000);
    return past ? `${m}m ago` : `in ${m}m`;
  }
  if (absDiff < DAY_MS) {
    const h = Math.round(absDiff / 3600000);
    return past ? `${h}h ago` : `in ${h}h`;
  }
  const d = Math.round(absDiff / DAY_MS);
  return past ? `${d}d ago` : `in ${d}d`;
}

function isDue(isoString) {
  if (!isoString) return true;
  return new Date(isoString).getTime() <= Date.now();
}
