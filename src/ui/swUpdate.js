// Service-worker update flow. Detects when a new service worker has installed
// and is waiting, surfaces a banner asking the user to reload, and reloads
// once the new SW takes control.

const SW_UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
let _updateBannerShown = false;

function _showUpdateBanner(onReload) {
  if (_updateBannerShown) return;
  _updateBannerShown = true;

  const banner = el("div", { className: "install-hint", role: "dialog", "aria-label": "Update available" });

  banner.appendChild(el("div", { className: "install-hint__body" },
    "A new version of Text Memorizer is ready."));

  const buttons = el("div", { className: "install-hint__buttons" });
  buttons.appendChild(el("button", {
    className: "btn btn--primary install-hint__action",
    onClick: () => { banner.remove(); onReload(); }
  }, "Reload"));
  buttons.appendChild(el("button", {
    className: "install-hint__close",
    "aria-label": "Dismiss",
    onClick: () => { banner.remove(); _updateBannerShown = false; }
  }, "×"));
  banner.appendChild(buttons);

  document.body.appendChild(banner);
}

function _activateWaitingWorker(waiting) {
  // After the new SW activates, the browser fires controllerchange — reload
  // then so the page runs the new code.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload();
  }, { once: true });
  waiting.postMessage({ type: "SKIP_WAITING" });
}

function _trackWorker(worker) {
  worker.addEventListener("statechange", () => {
    // "installed" + an existing controller means this is an update, not a
    // first install. (First installs have no prior controller.)
    if (worker.state === "installed" && navigator.serviceWorker.controller) {
      _showUpdateBanner(() => _activateWaitingWorker(worker));
    }
  });
}

async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register("sw.js");

    // A SW may already be waiting from a previous session that never reloaded.
    if (reg.waiting && navigator.serviceWorker.controller) {
      _showUpdateBanner(() => _activateWaitingWorker(reg.waiting));
    }

    if (reg.installing) _trackWorker(reg.installing);
    reg.addEventListener("updatefound", () => {
      if (reg.installing) _trackWorker(reg.installing);
    });

    // Periodically poll for a new SW so long-running tabs notice updates
    // without needing a fresh page load.
    setInterval(() => { reg.update().catch(() => {}); }, SW_UPDATE_CHECK_INTERVAL_MS);
  } catch (err) {
    console.error("SW registration failed:", err);
  }
}
