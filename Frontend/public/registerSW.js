(() => {
  const workers = navigator.serviceWorker;
  const workerURL = new URL("/sw.js?shell=network", location.origin).href;
  // Older cached HTML also points to this script, but lacks the network shell marker.
  const legacyShell = !document.currentScript?.hasAttribute("data-network-shell");
  const hadNetworkController = workers?.controller?.scriptURL === workerURL;
  const migrationKey = "social:pwa-shell-migration";
  let reloadRequested = false;
  let activating = false;
  let updateButton;

  async function reloadLegacyShell() {
    const old = await workers.getRegistration();
    if (old && workers.controller?.scriptURL !== workerURL) await old.unregister();
    try { sessionStorage.setItem(migrationKey, "pending"); } catch { /* Storage may be restricted. */ }
    location.reload();
  }

  function offerReload(waiting) {
    if (!updateButton) {
      updateButton = document.createElement("button");
      updateButton.type = "button";
      updateButton.textContent = "Update available · Reload app";
      Object.assign(updateButton.style, {
        position: "fixed", bottom: "88px", left: "12px", zIndex: "1200",
        padding: "9px 13px", border: "1px solid #475a6b", borderRadius: "10px",
        color: "#f0f4f8", background: "#22313d", font: "600 14px system-ui",
      });
      if (document.body) document.body.append(updateButton);
      else document.addEventListener("DOMContentLoaded", () => document.body.append(updateButton), { once: true });
    }
    updateButton.onclick = () => {
      if (waiting?.state === "installed") {
        activate(waiting);
      } else {
        location.reload();
      }
    };
  }

  // An open tab can still reference a lazy chunk from the previous release.
  window.addEventListener("vite:preloadError", () => {
    if (navigator.onLine) offerReload();
  });
  if (!workers) return;

  function canReloadLegacyShell() {
    const writing = [...document.querySelectorAll(".thread-compose input, .thread-compose textarea")]
      .some((input) => input.value);
    return legacyShell && !writing && !document.querySelector(".call-screen");
  }

  function activate(waiting) {
    activating = true;
    waiting.postMessage({ type: "SKIP_WAITING" });
  }

  function handleNewController() {
    if (reloadRequested || workers.controller?.scriptURL !== workerURL) return;
    if (activating || canReloadLegacyShell()) {
      reloadRequested = true;
      location.reload();
    } else if (legacyShell || hadNetworkController) {
      offerReload();
    }
  }

  workers.addEventListener("controllerchange", handleNewController);
  if (legacyShell && workers.controller?.scriptURL !== workerURL && navigator.onLine) {
    // Release the old shell even if it still has a long-lived chat request.
    let attempted = false;
    try { attempted = sessionStorage.getItem(migrationKey) === "pending"; } catch { /* Storage may be restricted. */ }
    if (canReloadLegacyShell() && !attempted) void reloadLegacyShell().catch(() => offerReload());
    else {
      offerReload();
      updateButton.onclick = () => { void reloadLegacyShell().catch(() => location.reload()); };
    }
    return;
  }
  if (!legacyShell) {
    try { sessionStorage.removeItem(migrationKey); } catch { /* Storage may be restricted. */ }
  }

  let observedRegistration;
  function registerWorker() {
    if (observedRegistration) {
      void observedRegistration.update().catch(() => {});
      return;
    }
    void workers.register(workerURL, { scope: "/", updateViaCache: "none" }).then(observeRegistration).catch(() => {});
  }

  function observeRegistration(registration) {
    if (observedRegistration) return;
    observedRegistration = registration;
    function handleWaitingWorker() {
      const waiting = registration.waiting;
      if (waiting?.scriptURL !== workerURL || activating) return;
      if (!legacyShell && !hadNetworkController) waiting.postMessage({ type: "SKIP_WAITING" });
      else if (canReloadLegacyShell()) activate(waiting);
      else offerReload(waiting);
    }
    function observeInstall() {
      registration.installing?.addEventListener("statechange", handleWaitingWorker);
    }
    registration.addEventListener("updatefound", observeInstall);
    observeInstall();
    handleWaitingWorker();
    // Handle a controller that finished activating before this script was fetched.
    if (legacyShell) handleNewController();
    function checkForUpdate() {
      if (document.visibilityState === "visible") void registration.update().catch(() => {});
    }
    document.addEventListener("visibilitychange", checkForUpdate);
  }
  window.addEventListener("online", registerWorker);
  registerWorker();
})();
