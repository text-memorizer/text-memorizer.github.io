// Shared media helpers for inserting images and audio into markdown textareas.

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return fileToDataUrl(blob);
}

function insertAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

async function handleImageFiles(textarea, files) {
  for (const f of files) {
    if (!f.type || !f.type.startsWith("image/")) continue;
    if (f.size > MAX_IMAGE_BYTES) {
      showToast(`Image "${f.name}" exceeds 5 MB and was skipped.`, "error");
      continue;
    }
    try {
      const dataUrl = await fileToDataUrl(f);
      const alt = (f.name || "image").replace(/[\[\]]/g, "");
      insertAtCursor(textarea, `\n\n![${alt}](${dataUrl})\n\n`);
    } catch {
      showToast(`Failed to read image "${f.name}".`, "error");
    }
  }
}

async function handleAudioFile(textarea, file) {
  if (!file) return;
  if (!file.type || !file.type.startsWith("audio/")) {
    showToast(`"${file.name}" is not an audio file.`, "error");
    return;
  }
  if (file.size > MAX_AUDIO_BYTES) {
    showToast(`Audio "${file.name}" exceeds 10 MB and was skipped.`, "error");
    return;
  }
  try {
    const dataUrl = await fileToDataUrl(file);
    insertAudioTag(textarea, dataUrl);
  } catch {
    showToast(`Failed to read audio "${file.name}".`, "error");
  }
}

function insertAudioTag(textarea, dataUrl) {
  insertAtCursor(textarea, `\n\n<audio controls src="${dataUrl}"></audio>\n\n`);
}

// startRecording: opens the mic and begins recording.
// Resolves with a controller: { stop(): Promise<Blob>, cancel(), elapsedMs() }.
// Rejects if getUserMedia is unsupported or denied (caller shows a toast).
async function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === "undefined") {
    const err = new Error("Recording not supported");
    err.code = "unsupported";
    throw err;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    const err = new Error("Microphone access denied");
    err.code = "denied";
    err.cause = e;
    throw err;
  }

  const recorder = new MediaRecorder(stream);
  const chunks = [];
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  });

  const startedAt = Date.now();
  let finished = false;

  function releaseStream() {
    try { stream.getTracks().forEach((t) => t.stop()); } catch {}
  }

  recorder.start();

  return {
    stop() {
      if (finished) return Promise.resolve(new Blob([], { type: recorder.mimeType || "audio/webm" }));
      finished = true;
      return new Promise((resolve) => {
        recorder.addEventListener("stop", () => {
          releaseStream();
          resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
        }, { once: true });
        try { recorder.stop(); } catch { releaseStream(); resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" })); }
      });
    },
    cancel() {
      if (finished) return;
      finished = true;
      try { recorder.stop(); } catch {}
      releaseStream();
    },
    elapsedMs() {
      return Date.now() - startedAt;
    }
  };
}

function formatMmSs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Opens a modal with Start / Stop / Cancel and a mm:ss timer.
// Calls onInserted() after a successful recording is inserted into the textarea.
function openAudioRecorderModal(textarea, onInserted) {
  let controller = null;
  let timerId = null;

  const timerEl = el("div", { className: "recorder-timer" }, "00:00");
  const statusEl = el("div", { className: "recorder-status" }, "Ready to record");

  const startBtn = el("button", { className: "btn btn--primary", type: "button" }, "Start");
  const stopBtn = el("button", { className: "btn", type: "button" }, "Stop");
  const cancelBtn = el("button", { className: "btn btn--ghost", type: "button" }, "Cancel");
  stopBtn.disabled = true;

  const body = el("div", { className: "recorder-body" },
    statusEl,
    timerEl
  );

  function updateTimer() {
    if (controller) timerEl.textContent = formatMmSs(controller.elapsedMs());
  }

  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  let close = null;

  function cleanup() {
    stopTimer();
    if (controller) {
      try { controller.cancel(); } catch {}
      controller = null;
    }
  }

  startBtn.addEventListener("click", async () => {
    startBtn.disabled = true;
    statusEl.textContent = "Requesting microphone…";
    try {
      controller = await startRecording();
    } catch (e) {
      if (e && e.code === "unsupported") {
        showToast("Recording not supported in this browser", "error");
      } else {
        showToast("Microphone access denied", "error");
      }
      if (close) close();
      return;
    }
    statusEl.textContent = "Recording…";
    stopBtn.disabled = false;
    timerEl.textContent = "00:00";
    timerId = setInterval(updateTimer, 250);
  });

  stopBtn.addEventListener("click", async () => {
    if (!controller) return;
    stopBtn.disabled = true;
    statusEl.textContent = "Finishing…";
    stopTimer();
    const current = controller;
    controller = null;
    let blob;
    try {
      blob = await current.stop();
    } catch {
      showToast("Recording failed.", "error");
      if (close) close();
      return;
    }
    if (!blob || blob.size === 0) {
      showToast("No audio captured.", "error");
      if (close) close();
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(blob);
      insertAudioTag(textarea, dataUrl);
      if (onInserted) onInserted();
    } catch {
      showToast("Failed to encode recording.", "error");
    }
    if (close) close();
  });

  cancelBtn.addEventListener("click", () => {
    cleanup();
    if (close) close();
  });

  close = showModal({
    title: "Record audio",
    body,
    actions: [],
    onClose: () => cleanup()
  });

  // showModal renders an empty footer when actions=[]. Populate it with our
  // own buttons so we own their state and don't auto-close on click.
  const overlays = document.querySelectorAll(".modal-overlay");
  const dialog = overlays.length ? overlays[overlays.length - 1].querySelector(".modal-dialog") : null;
  const footer = dialog ? dialog.querySelector(".modal-footer") : null;
  if (footer) {
    footer.appendChild(cancelBtn);
    footer.appendChild(stopBtn);
    footer.appendChild(startBtn);
  }
}
