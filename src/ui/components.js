function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "className") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function showToast(message, type = "info") {
  const toast = el("div", { className: `toast toast--${type}` }, message);
  document.getElementById("toast-container").appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showModal(opts) {
  const { title, body, actions = [], onClose } = opts;
  const overlay = el("div", { className: "modal-overlay" });
  const dialog = el("div", { className: "modal-dialog", role: "dialog", "aria-modal": "true" });

  if (title) dialog.appendChild(el("h2", { className: "modal-title" }, title));

  const bodyWrap = el("div", { className: "modal-body" });
  if (typeof body === "string") bodyWrap.textContent = body;
  else bodyWrap.appendChild(body);
  dialog.appendChild(bodyWrap);

  const footer = el("div", { className: "modal-footer" });
  for (const { label, action, primary, danger } of actions) {
    const cls = ["btn", primary && "btn--primary", danger && "btn--danger"].filter(Boolean).join(" ");
    const btn = el("button", { className: cls, onClick: () => { action(); closeModal(); } }, label);
    footer.appendChild(btn);
  }
  dialog.appendChild(footer);
  overlay.appendChild(dialog);

  function closeModal() {
    overlay.remove();
    if (onClose) onClose();
  }

  overlay.addEventListener("click", e => { if (e.target === overlay) closeModal(); });
  document.getElementById("modal-container").appendChild(overlay);

  return closeModal;
}

function confirmModal(message, onConfirm, onCancel) {
  showModal({
    title: "Confirm",
    body: message,
    actions: [
      { label: "Cancel", action: onCancel || (() => {}) },
      { label: "Confirm", action: onConfirm, primary: true }
    ]
  });
}

function setScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("screen--active"));
  const screen = document.getElementById(`screen-${name}`);
  if (screen) screen.classList.add("screen--active");
  appState.currentScreen = name;
  bus.emit("screenChange", name);
}
