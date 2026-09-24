// floop launcher popup.
//
// Reads the active tab URL (via the `activeTab` permission — no host permissions
// needed) into an editable field, and opens the floop web app's /dashboard/new
// page with that URL prefilled. All review creation, auth, annotation, and
// sharing happen in the web app; this popup only launches into it.

// The floop web app origin — single source of truth.
// To develop against a local server, comment the production line below and
// uncomment the localhost line.
// const FLOOP_ORIGIN = "https://floop.design";
const FLOOP_ORIGIN = "http://localhost:3000";

const urlInput = document.getElementById("url");
const noteEl = document.getElementById("note");
const startBtn = document.getElementById("start");
const copyBtn = document.getElementById("copy");
const copyLabel = document.getElementById("copyLabel");
const copyAnnouncement = document.getElementById("copyAnnouncement");
const editBtn = document.getElementById("edit");

const COPY_FEEDBACK_MS = 1500;
let copyFeedbackTimer = null;

// "Copy" and "Edit" mirror what their labels say and nothing more — copy the
// field's current value, or focus/select it for editing. The field is always
// editable regardless; this just matches the click target to the label.
copyBtn.addEventListener("click", async () => {
  await navigator.clipboard.writeText(urlInput.value.trim());

  clearTimeout(copyFeedbackTimer);
  copyBtn.classList.add("is-copied");
  copyLabel.textContent = "Copied";
  copyAnnouncement.textContent = "Copied to clipboard";

  copyFeedbackTimer = setTimeout(() => {
    copyBtn.classList.remove("is-copied");
    copyLabel.textContent = "Copy";
    copyAnnouncement.textContent = "";
  }, COPY_FEEDBACK_MS);
});

editBtn.addEventListener("click", () => {
  urlInput.focus();
  urlInput.select();
});

function showNote(message) {
  noteEl.textContent = message;
  noteEl.style.display = "block";
}

/** Only http/https are reviewable. Validated again server-side in the web app. */
function isSupported(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** The button is enabled only when the field currently holds a valid URL. */
function syncButton() {
  startBtn.disabled = !isSupported(urlInput.value.trim());
}

// Re-validate as the user edits the URL.
urlInput.addEventListener("input", syncButton);

startBtn.addEventListener("click", () => {
  const value = urlInput.value.trim();
  if (!isSupported(value)) return;
  chrome.tabs.create({
    url: `${FLOOP_ORIGIN}/dashboard/new?url=${encodeURIComponent(value)}`,
  });
  window.close();
});

async function init() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    urlInput.placeholder = "https://example.com";
    showNote("Couldn't read the current tab. Enter a website URL to continue.");
    syncButton();
    return;
  }

  const tabUrl = tab && tab.url ? tab.url : "";

  if (isSupported(tabUrl)) {
    // Prefill, but leave it editable so the user can correct it before starting.
    urlInput.value = tabUrl;
  } else {
    // Unsupported page (chrome://, file://, about:, …). Leave the field empty so
    // the user can still type a website to review.
    urlInput.value = "";
    urlInput.placeholder = "https://example.com";
    showNote(
      "floop can only review http:// or https:// websites. This page isn't supported — enter a website URL to continue."
    );
  }

  syncButton();
}

init();
