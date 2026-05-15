// Bottom banner that nudges first-time mobile visitors to add the app to
// their home screen, so they get the offline-launcher experience without a
// real app store. Shown once per device; dismissal is persisted.

const INSTALL_HINT_KEY = "installHintDismissed";

function _isStandalone() {
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
  if (window.navigator && window.navigator.standalone === true) return true;
  return false;
}

function _isIOS() {
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return iOS || iPadOS;
}

function _isAndroid() {
  return /Android/i.test(navigator.userAgent || "");
}

function _dismissed() {
  try { return localStorage.getItem(INSTALL_HINT_KEY) === "1"; } catch { return false; }
}

function _markDismissed() {
  try { localStorage.setItem(INSTALL_HINT_KEY, "1"); } catch {}
}

function _renderBanner({ text, actionLabel, onAction }) {
  const banner = el("div", { className: "install-hint", role: "dialog", "aria-label": "Install app" });

  const body = el("div", { className: "install-hint__body" }, text);
  banner.appendChild(body);

  const buttons = el("div", { className: "install-hint__buttons" });
  if (actionLabel && onAction) {
    const actionBtn = el("button",
      { className: "btn btn--primary install-hint__action", onClick: () => { onAction(); _dismiss(); } },
      actionLabel);
    buttons.appendChild(actionBtn);
  }
  const closeBtn = el("button",
    { className: "install-hint__close", "aria-label": "Dismiss", onClick: _dismiss },
    "×");
  buttons.appendChild(closeBtn);
  banner.appendChild(buttons);

  function _dismiss() {
    _markDismissed();
    banner.classList.add("install-hint--leaving");
    setTimeout(() => banner.remove(), 200);
  }

  document.body.appendChild(banner);
}

function maybeShowInstallHint() {
  if (_isStandalone()) return;
  if (_dismissed()) return;

  if (_isAndroid()) {
    // Chrome fires beforeinstallprompt when the PWA is installable. Capture
    // it, then surface a banner with a native install button.
    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      setTimeout(() => {
        if (_dismissed() || _isStandalone()) return;
        _renderBanner({
          text: "Install Text Memorizer for offline use and a home-screen icon.",
          actionLabel: "Install",
          onAction: async () => {
            try { e.prompt(); await e.userChoice; } catch {}
          }
        });
      }, 4000);
    }, { once: true });
    return;
  }

  if (_isIOS()) {
    // iOS Safari has no install prompt API — show text instructions instead.
    setTimeout(() => {
      if (_dismissed() || _isStandalone()) return;
      _renderBanner({
        text: "Add to Home Screen: tap the Share button, then “Add to Home Screen” for offline access."
      });
    }, 4000);
  }
}
