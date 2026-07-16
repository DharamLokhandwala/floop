// floop launcher popup.
//
// Reads the active tab URL (via the `activeTab` permission — no host permissions
// needed), and opens the floop web app's /dashboard/new page with the URL
// prefilled. All review creation, auth, annotation, and sharing happen in the web
// app; this popup only launches into it.

// Where the floop web app is hosted. Change to your production origin before
// shipping (e.g. "https://app.floop.design"). Defaults to local dev.
const FLOOP_ORIGIN = "http://localhost:3000";

const urlEl = document.getElementById("url");
const noteEl = document.getElementById("note");
const startBtn = document.getElementById("start");

function showNote(message) {
  noteEl.textContent = message;
  noteEl.style.display = "block";
}

function isSupported(rawUrl) {
  try {
    const u = new URL(rawUrl);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function init() {
  let tab;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch {
    urlEl.textContent = "Couldn't read the current tab.";
    return;
  }

  const tabUrl = tab && tab.url ? tab.url : "";

  if (!tabUrl || !isSupported(tabUrl)) {
    urlEl.textContent = tabUrl || "No page detected.";
    startBtn.disabled = true;
    showNote(
      "floop can only review normal http:// or https:// websites. This page (e.g. a browser, extension, or local file page) isn't supported."
    );
    return;
  }

  // Show a friendly hostname, keep the full URL for the launch.
  try {
    urlEl.textContent = new URL(tabUrl).hostname;
  } catch {
    urlEl.textContent = tabUrl;
  }

  startBtn.disabled = false;
  startBtn.addEventListener("click", () => {
    const target = `${FLOOP_ORIGIN}/dashboard/new?url=${encodeURIComponent(tabUrl)}`;
    chrome.tabs.create({ url: target });
    window.close();
  });
}

init();
