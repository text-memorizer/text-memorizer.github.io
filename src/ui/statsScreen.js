function renderStatsScreen(db) {
  const screen = document.getElementById("screen-stats");
  screen.innerHTML = "";

  const header = el("div", { className: "screen-header" },
    el("button", { className: "btn btn--ghost", onClick: () => { setScreen("library"); renderLibraryScreen(db); } }, "← Back"),
    el("h1", {}, "Stats")
  );
  screen.appendChild(header);

  const body = el("div", { className: "stats-grid" });
  body.appendChild(el("p", { className: "stats-loading" }, "Loading…"));
  screen.appendChild(body);

  loadStats(db, body).catch(err => {
    console.error("Stats load failed:", err);
    body.innerHTML = "";
    body.appendChild(el("p", { className: "empty-state" }, "Failed to load stats: " + err.message));
  });
}

async function loadStats(db, body) {
  const [reviews, sessions, cards] = await Promise.all([
    repo.getAllReviews(db),
    repo.getAllSessions(db),
    repo.getAllCards(db)
  ]);
  const liveCards = cards.filter(c => !c.deletedAt);

  body.innerHTML = "";

  const streak = computeStatsStreak(reviews);
  const totalMs = reviews.reduce((sum, r) => sum + (r.interactionStats?.totalTimeMs || 0), 0);

  body.appendChild(el("div", { className: "stats-kpis" },
    statsKpi("Current streak", streak === 0 ? "0 days" : `${streak} day${streak === 1 ? "" : "s"}`),
    statsKpi("Total reviews", String(reviews.length)),
    statsKpi("Total review time", formatStatsDuration(totalMs)),
    statsKpi("Sessions", String(sessions.length))
  ));

  body.appendChild(statsPanel("Reviews — last 30 days",
    statsBarChart(reviewsPerDay(reviews))
  ));

  body.appendChild(statsPanel("Mastery distribution",
    statsBarChart(masteryBuckets(liveCards), { showLabels: true })
  ));

  body.appendChild(statsPanel("Due in the next 7 days",
    statsBarChart(dueSoonBuckets(liveCards), { showLabels: true })
  ));

  body.appendChild(statsPanel("Ratings — last 30 days",
    statsBarChart(ratingBuckets(reviews), { showLabels: true })
  ));

  if (!reviews.length) {
    body.appendChild(el("p", { className: "empty-state" },
      "No reviews yet. Stats will appear once you review some cards."));
  }
}

function statsKpi(label, value) {
  return el("div", { className: "stats-kpi" },
    el("div", { className: "stats-kpi-value" }, value),
    el("div", { className: "stats-kpi-label" }, label)
  );
}

function statsPanel(title, content) {
  return el("div", { className: "stats-panel" },
    el("h3", { className: "stats-panel-title" }, title),
    content
  );
}

function statsLocalDateKey(timestamp) {
  const d = new Date(timestamp);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStatsStreak(reviews) {
  const days = new Set(reviews.map(r => statsLocalDateKey(r.reviewedAt)));
  if (!days.size) return 0;
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.has(statsLocalDateKey(cursor))) {
    streak++;
    cursor.setTime(cursor.getTime() - 86400000);
  }
  return streak;
}

function formatStatsDuration(ms) {
  if (!ms || ms < 1000) return "—";
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function reviewsPerDay(reviews) {
  const counts = new Map();
  for (const r of reviews) counts.set(statsLocalDateKey(r.reviewedAt), (counts.get(statsLocalDateKey(r.reviewedAt)) || 0) + 1);
  const items = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    items.push({
      value: counts.get(statsLocalDateKey(d)) || 0,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    });
  }
  return items;
}

function masteryBuckets(cards) {
  const buckets = [
    { label: "0–25%", lo: 0, hi: 0.25, value: 0 },
    { label: "25–50%", lo: 0.25, hi: 0.5, value: 0 },
    { label: "50–75%", lo: 0.5, hi: 0.75, value: 0 },
    { label: "75–100%", lo: 0.75, hi: 1.01, value: 0 }
  ];
  for (const c of cards) {
    const p = c.cardStats?.masteryPercent || 0;
    for (const b of buckets) {
      if (p >= b.lo && p < b.hi) { b.value++; break; }
    }
  }
  return buckets;
}

function dueSoonBuckets(cards) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = [];
  const keyToIdx = new Map();
  for (let i = 0; i < 7; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    keyToIdx.set(statsLocalDateKey(d), i);
    items.push({
      value: 0,
      label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })
    });
  }
  for (const c of cards) {
    const due = c.cardStats?.nextDueAt;
    if (!due) continue;
    const dueMs = new Date(due).getTime();
    const key = statsLocalDateKey(due);
    if (keyToIdx.has(key)) items[keyToIdx.get(key)].value++;
    else if (dueMs < today.getTime()) items[0].value++;
  }
  return items;
}

function ratingBuckets(reviews) {
  const cutoff = Date.now() - 30 * 86400000;
  const order = ["again", "hard", "good", "easy", "perfect"];
  const counts = Object.fromEntries(order.map(k => [k, 0]));
  for (const r of reviews) {
    if (new Date(r.reviewedAt).getTime() < cutoff) continue;
    if (r.userRating in counts) counts[r.userRating]++;
  }
  return order.map(label => ({ value: counts[label], label }));
}

function statsSvgEl(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

function statsBarChart(items, opts = {}) {
  const width = opts.width || 640;
  const height = opts.height || 180;
  const padT = 14, padR = 8, padB = 30, padL = 32;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const max = Math.max(1, ...items.map(i => i.value));
  const slot = innerW / Math.max(1, items.length);
  const barW = Math.max(2, slot * 0.75);

  const svg = statsSvgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    class: "stats-chart",
    preserveAspectRatio: "xMidYMid meet",
    role: "img"
  });

  svg.appendChild(statsSvgEl("line", {
    x1: padL, y1: padT + innerH, x2: padL + innerW, y2: padT + innerH,
    class: "stats-axis"
  }));

  const maxLabel = statsSvgEl("text", {
    x: padL - 6, y: padT + 4, "text-anchor": "end", "dominant-baseline": "hanging",
    class: "stats-axis-label"
  });
  maxLabel.textContent = String(max);
  svg.appendChild(maxLabel);

  const zeroLabel = statsSvgEl("text", {
    x: padL - 6, y: padT + innerH, "text-anchor": "end", "dominant-baseline": "middle",
    class: "stats-axis-label"
  });
  zeroLabel.textContent = "0";
  svg.appendChild(zeroLabel);

  items.forEach((item, i) => {
    const h = (item.value / max) * innerH;
    const x = padL + i * slot + (slot - barW) / 2;
    const y = padT + (innerH - h);
    const rect = statsSvgEl("rect", {
      x, y, width: barW, height: Math.max(0, h),
      class: "stats-bar", rx: 2
    });
    const t = statsSvgEl("title");
    t.textContent = `${item.label}: ${item.value}`;
    rect.appendChild(t);
    svg.appendChild(rect);
  });

  if (opts.showLabels) {
    items.forEach((item, i) => {
      const t = statsSvgEl("text", {
        x: padL + i * slot + slot / 2,
        y: padT + innerH + 14,
        "text-anchor": "middle",
        class: "stats-axis-label"
      });
      t.textContent = item.label;
      svg.appendChild(t);
    });
  } else if (items.length > 0) {
    const step = Math.max(1, Math.floor(items.length / 6));
    for (let i = 0; i < items.length; i += step) {
      const t = statsSvgEl("text", {
        x: padL + i * slot + slot / 2,
        y: padT + innerH + 14,
        "text-anchor": "middle",
        class: "stats-axis-label"
      });
      t.textContent = items[i].label;
      svg.appendChild(t);
    }
    const lastIdx = items.length - 1;
    if (lastIdx % step !== 0) {
      const t = statsSvgEl("text", {
        x: padL + lastIdx * slot + slot / 2,
        y: padT + innerH + 14,
        "text-anchor": "middle",
        class: "stats-axis-label"
      });
      t.textContent = items[lastIdx].label;
      svg.appendChild(t);
    }
  }

  return svg;
}
