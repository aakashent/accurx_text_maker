/*
Accurx Text Maker
v2.0

Fixes:
- You can always remove selected links from the "Currently included" pills.
- Adds favourites (★). Stored in localStorage.

Assumptions about data files:
- templates.json: [{ "name": "Ear infection template", "text": "Thanks for attending today..." }, ...]
- links_titles.json: [
    { "title": "Glue Ear (Glue ear in children)", "url": "https://...", "short": "Glue ear" },
    { "title": "Tonsils and adenoids", "url": "https://...", "short": "Tonsils" },
    ...
  ]
*/

/////////////////////////////
// DOM refs
/////////////////////////////

const templateSelectEl   = document.getElementById("templateSelect");
const selectedListEl     = document.getElementById("selectedList");
const searchBoxEl        = document.getElementById("searchBox");
const favouritesListEl   = document.getElementById("favouritesList");
const resultsListEl      = document.getElementById("resultsList");
const messageOutputEl    = document.getElementById("messageOutput");
const copyBtnEl          = document.getElementById("copyBtn");

/////////////////////////////
// State
/////////////////////////////

let ALL_LEAFLETS = [];      // full leaflet library from links_titles.json
let templates = [];         // [{name,text},...]
let selectedLeaflets = [];  // [{title,url}, ...] current picks for this message
let favourites = [];        // ["url1","url2",...] persisted

/////////////////////////////
// Init
/////////////////////////////

init();

async function init() {
  loadFavouritesFromStorage();

  await Promise.all([loadLeaflets(), loadTemplates()]);

  renderTemplateSelect();
  renderSelected();
  renderFavourites();
  renderResults(); // initially empty until user types
  updateMessageOutput(); // build output with intro if any

  // wire events
  searchBoxEl.addEventListener("input", handleSearchInput);
  templateSelectEl.addEventListener("change", updateMessageOutput);
  copyBtnEl.addEventListener("click", handleCopy);
}

/////////////////////////////
// Data loading
/////////////////////////////

async function loadLeaflets() {
  // same folder fetch
  const res = await fetch("links_titles.json");
  ALL_LEAFLETS = await res.json();

  // optional: sort alphabetically
  ALL_LEAFLETS.sort((a, b) => a.title.localeCompare(b.title));
}

async function loadTemplates() {
  // same folder fetch
  const res = await fetch("templates.json");
  templates = await res.json();
}

/////////////////////////////
// Favourites persistence
/////////////////////////////

function loadFavouritesFromStorage() {
  try {
    const raw = localStorage.getItem("accurx_favourites");
    favourites = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(favourites)) favourites = [];
  } catch (err) {
    favourites = [];
  }
}

function saveFavouritesToStorage() {
  localStorage.setItem("accurx_favourites", JSON.stringify(favourites));
}

/////////////////////////////
// Utility helpers
/////////////////////////////

function isSelected(url) {
  return selectedLeaflets.some((l) => l.url === url);
}

function isFavourite(url) {
  return favourites.includes(url);
}

function getLeafletByUrl(url) {
  return ALL_LEAFLETS.find((l) => l.url === url);
}

function addLeaflet(leaflet) {
  if (!isSelected(leaflet.url)) {
    selectedLeaflets.push({
      title: leaflet.title,
      url: leaflet.url,
    });
    renderSelected();
    renderResults();
    renderFavourites();
    updateMessageOutput();
  }
}

function removeLeaflet(url) {
  selectedLeaflets = selectedLeaflets.filter((l) => l.url !== url);
  renderSelected();
  renderResults();
  renderFavourites();
  updateMessageOutput();
}

function toggleLeafletByUrl(url) {
  const lf = getLeafletByUrl(url);
  if (!lf) return;
  if (isSelected(url)) {
    removeLeaflet(url);
  } else {
    addLeaflet(lf);
  }
}

function toggleFavourite(url) {
  if (isFavourite(url)) {
    favourites = favourites.filter((f) => f !== url);
  } else {
    favourites.push(url);
  }
  saveFavouritesToStorage();
  renderFavourites();
  renderResults();
}

/////////////////////////////
// Build output message
/////////////////////////////

function updateMessageOutput() {
  // intro based on chosen template
  let introText = "";
  const selectedTemplateIndex = templateSelectEl.value;
  if (selectedTemplateIndex !== "" && templates[selectedTemplateIndex]) {
    introText = templates[selectedTemplateIndex].text.trim();
  }

  const linkLines = selectedLeaflets.map(
    (l) => `• ${l.title}: ${l.url}`
  );

  // Join with blank line between intro and links (if intro exists)
  let finalMsg = "";
  if (introText) {
    finalMsg = introText + "\n\n" + linkLines.join("\n");
  } else {
    // basic fallback wording if you prefer
    if (linkLines.length > 0) {
      finalMsg =
        "Here are the links we discussed today:\n\n" +
        linkLines.join("\n");
    } else {
      finalMsg = ""; // nothing chosen yet
    }
  }

  messageOutputEl.value = finalMsg.trim();
}

/////////////////////////////
// Rendering
/////////////////////////////

function renderTemplateSelect() {
  templateSelectEl.innerHTML = "";

  // default blank
  const optBlank = document.createElement("option");
  optBlank.value = "";
  optBlank.textContent = "No intro / blank message";
  templateSelectEl.appendChild(optBlank);

  templates.forEach((t, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.textContent = t.name;
    templateSelectEl.appendChild(opt);
  });
}

function renderSelected() {
  selectedListEl.innerHTML = "";

  if (selectedLeaflets.length === 0) {
    selectedListEl.innerHTML =
      `<div class="empty-hint">Nothing selected yet.</div>`;
    return;
  }

  selectedLeaflets.forEach((leaflet) => {
    const pill = document.createElement("div");
    pill.className = "selected-pill";

    pill.innerHTML = `
      <span class="pill-text">${leaflet.title}</span>
      <button class="pill-remove" data-url="${leaflet.url}" aria-label="Remove ${leaflet.title}">
        ❌
      </button>
    `;

    selectedListEl.appendChild(pill);
  });

  // hook up remove buttons
  selectedListEl.querySelectorAll(".pill-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const url = e.currentTarget.getAttribute("data-url");
      removeLeaflet(url);
    });
  });
}

function renderFavourites() {
  favouritesListEl.innerHTML = "";

  if (favourites.length === 0) {
    favouritesListEl.innerHTML =
      `<div class="empty-hint">No favourites yet. Tap ☆ to save one.</div>`;
    return;
  }

  favourites
    .map((url) => getLeafletByUrl(url))
    .filter(Boolean)
    .forEach((l) => {
      const row = document.createElement("div");
      row.className = "leaflet-row favourite-row";

      row.innerHTML = `
        <div class="leaflet-main">
          <div class="leaflet-title">${l.title}</div>
          <div class="leaflet-url">${l.url}</div>
        </div>
        <div class="leaflet-actions">
          <button class="btn-addremove js-toggle-add" data-url="${l.url}">
            ${isSelected(l.url) ? "Remove" : "Add"}
          </button>
          <button class="btn-fav js-toggle-fav" data-url="${l.url}" aria-label="Unfavourite ${l.title}">
            ★
          </button>
        </div>
      `;

      favouritesListEl.appendChild(row);
    });

  attachRowHandlers(favouritesListEl);
}

function renderResults() {
  const query = searchBoxEl.value || "";
  const trimmed = query.toLowerCase().trim();

  resultsListEl.innerHTML = "";

  if (!trimmed) {
    resultsListEl.innerHTML =
      `<div class="empty-hint">Start typing to search…</div>`;
    return;
  }

  const filtered = ALL_LEAFLETS.filter((l) => {
    const hay =
      (l.title || "") +
      " " +
      (l.short || "") +
      " " +
      (l.url || "");
    return hay.toLowerCase().includes(trimmed);
  });

  if (filtered.length === 0) {
    resultsListEl.innerHTML =
      `<div class="empty-hint">No matches.</div>`;
    return;
  }

  filtered.forEach((l) => {
    const row = document.createElement("div");
    row.className = "leaflet-row";

    row.innerHTML = `
      <div class="leaflet-main">
        <div class="leaflet-title">${l.title}</div>
        <div class="leaflet-url">${l.url}</div>
      </div>
      <div class="leaflet-actions">
        <button class="btn-addremove js-toggle-add" data-url="${l.url}">
          ${isSelected(l.url) ? "Remove" : "Add"}
        </button>
        <button class="btn-fav js-toggle-fav" data-url="${l.url}" aria-label="Favourite ${l.title}">
          ${isFavourite(l.url) ? "★" : "☆"}
        </button>
      </div>
    `;

    resultsListEl.appendChild(row);
  });

  attachRowHandlers(resultsListEl);
}

function attachRowHandlers(containerEl) {
  // Add/Remove (Add leaflet to selection OR remove)
  containerEl.querySelectorAll(".js-toggle-add").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const url = e.currentTarget.getAttribute("data-url");
      toggleLeafletByUrl(url);
    });
  });

  // Favourite toggle
  containerEl.querySelectorAll(".js-toggle-fav").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const url = e.currentTarget.getAttribute("data-url");
      toggleFavourite(url);
    });
  });
}

/////////////////////////////
// Events
/////////////////////////////

function handleSearchInput() {
  renderResults();
}

function handleCopy() {
  // iOS-safe copy approach
  messageOutputEl.select();
  messageOutputEl.setSelectionRange(0, 99999); // iOS

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch (_) {
    copied = false;
  }

  if (!copied && navigator.clipboard) {
    navigator.clipboard.writeText(messageOutputEl.value).then(() => {
      flashCopied();
    });
  } else {
    flashCopied();
  }
}

function flashCopied() {
  const originalText = copyBtnEl.textContent;
  copyBtnEl.textContent = "Copied!";
  setTimeout(() => {
    copyBtnEl.textContent = originalText;
  }, 1500);
}