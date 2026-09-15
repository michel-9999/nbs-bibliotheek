const PAGE_SIZE = 24;

const state = {
  books: [],
  filtered: [],
  query: "",
  category: "",
  language: "",
  sort: "title",
  page: 1,
};

const fields = {
  title: 0,
  author: 1,
  year: 2,
  category: 3,
  language: 4,
  card: 5,
  notes: 6,
  publisher: 7,
  inventoryNumber: 8,
};

const el = {};

document.addEventListener("DOMContentLoaded", async () => {
  ["search", "category", "language", "sort", "results", "result-summary", "pagination", "active-filters", "empty-state", "clear-filters", "book-dialog", "dialog-content"]
    .forEach((id) => { el[id] = document.getElementById(id); });

  bindEvents();
  try {
    const response = await fetch("data/books.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    state.books = data.books.map((row, index) => ({ row, index, search: makeSearchText(row) }));
    setOverview(data);
    populateFilters();
    restoreUrlState();
    applyFilters();
  } catch (error) {
    console.error(error);
    el.results.innerHTML = '<p class="error">De catalogus kon niet worden geladen. Probeer de pagina opnieuw te openen.</p>';
    el["result-summary"].textContent = "Laden mislukt";
  }
});

function bindEvents() {
  let timer;
  el.search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => updateState("query", el.search.value), 120);
  });
  ["category", "language", "sort"].forEach((name) => {
    el[name].addEventListener("change", () => updateState(name, el[name].value));
  });
  el["clear-filters"].addEventListener("click", clearFilters);
  document.querySelector("[data-clear]").addEventListener("click", clearFilters);
  el["active-filters"].addEventListener("click", (event) => {
    const button = event.target.closest("button[data-filter]");
    if (!button) return;
    const key = button.dataset.filter;
    state[key] = "";
    if (key === "query") el.search.value = "";
    else el[key].value = "";
    state.page = 1;
    applyFilters();
  });
  el.results.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-index]");
    if (button) showDetails(Number(button.dataset.index));
  });
  el.pagination.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-page]");
    if (!button) return;
    state.page = Number(button.dataset.page);
    render();
    document.getElementById("collectie").scrollIntoView({ behavior: "smooth" });
  });
  document.querySelector(".dialog-close").addEventListener("click", () => el["book-dialog"].close());
  el["book-dialog"].addEventListener("click", (event) => {
    if (event.target === el["book-dialog"]) el["book-dialog"].close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !/input|select|textarea/i.test(document.activeElement.tagName)) {
      event.preventDefault();
      el.search.focus();
    }
  });
}

function updateState(key, value) {
  state[key] = value.trim();
  state.page = 1;
  applyFilters();
}

function makeSearchText(row) {
  return row.map((value) => String(value || "")).join(" ").toLocaleLowerCase("nl");
}

function normalize(value) {
  return String(value || "").trim();
}

function naturalCompare(a, b) {
  return normalize(a).localeCompare(normalize(b), "nl", { numeric: true, sensitivity: "base" });
}

function setOverview(data) {
  const categories = new Set(state.books.map(({ row }) => normalize(row[fields.category])).filter(Boolean));
  const years = state.books.map(({ row }) => Number(row[fields.year])).filter((year) => year >= 1000 && year <= new Date().getFullYear());
  document.getElementById("book-count").textContent = new Intl.NumberFormat("nl-BE").format(data.rows);
  document.getElementById("category-count").textContent = categories.size;
  document.getElementById("year-range").textContent = years.length ? `${Math.min(...years)}—${Math.max(...years)}` : "—";
}

function populateFilters() {
  fillSelect(el.category, uniqueValues(fields.category));
  fillSelect(el.language, uniqueValues(fields.language));
}

function uniqueValues(index) {
  return [...new Set(state.books.map(({ row }) => normalize(row[index])).filter(Boolean))].sort(naturalCompare);
}

function fillSelect(select, values, label = (value) => value) {
  const fragment = document.createDocumentFragment();
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label(value);
    fragment.appendChild(option);
  });
  select.appendChild(fragment);
}

function applyFilters() {
  const terms = state.query.toLocaleLowerCase("nl").split(/\s+/).filter(Boolean);
  state.filtered = state.books.filter(({ row, search }) => {
    if (state.category && normalize(row[fields.category]) !== state.category) return false;
    if (state.language && normalize(row[fields.language]) !== state.language) return false;
    return terms.every((term) => search.includes(term));
  });

  const sorters = {
    title: (a, b) => naturalCompare(a.row[fields.title], b.row[fields.title]),
    author: (a, b) => naturalCompare(a.row[fields.author], b.row[fields.author]) || naturalCompare(a.row[fields.title], b.row[fields.title]),
    "year-desc": (a, b) => compareYears(a.row, b.row, -1) || naturalCompare(a.row[fields.title], b.row[fields.title]),
    "year-asc": (a, b) => compareYears(a.row, b.row, 1) || naturalCompare(a.row[fields.title], b.row[fields.title]),
  };
  state.filtered.sort(sorters[state.sort]);
  syncUrl();
  render();
}

function validYear(row) {
  const year = Number(row[fields.year]);
  return Number.isFinite(year) && year > 0 ? year : null;
}

function compareYears(rowA, rowB, direction) {
  const a = validYear(rowA);
  const b = validYear(rowB);
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

function render() {
  const total = state.filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const start = (state.page - 1) * PAGE_SIZE;
  renderBooks(state.filtered.slice(start, start + PAGE_SIZE));
  renderPagination(pages);
  renderActiveFilters();
  el["empty-state"].hidden = total !== 0;
  el.results.hidden = total === 0;
  el["result-summary"].innerHTML = `<strong>${new Intl.NumberFormat("nl-BE").format(total)}</strong> ${total === 1 ? "werk" : "werken"} gevonden`;
  el["clear-filters"].disabled = !hasFilters();
}

function renderBooks(books) {
  const template = document.getElementById("book-template");
  const fragment = document.createDocumentFragment();
  books.forEach(({ row, index }) => {
    const node = template.content.cloneNode(true);
    node.querySelector("h3").textContent = normalize(row[fields.title]) || "Zonder titel";
    node.querySelector(".author").textContent = normalize(row[fields.author]) || "Auteur onbekend";
    node.querySelector(".category-pill").textContent = normalize(row[fields.category]) || "Ongecategoriseerd";
    node.querySelector(".language").textContent = normalize(row[fields.language]) || "Taal onbekend";
    node.querySelector(".year").textContent = displayYear(row[fields.year]);
    node.querySelector(".detail-button").dataset.index = index;
    fragment.appendChild(node);
  });
  el.results.replaceChildren(fragment);
}

function displayYear(value) {
  return normalize(value) || "Jaar onbekend";
}

function renderActiveFilters() {
  const labels = { query: "Zoekterm", category: "Onderwerp", language: "Taal" };
  const fragment = document.createDocumentFragment();
  Object.keys(labels).forEach((key) => {
    if (!state[key]) return;
    const button = document.createElement("button");
    button.className = "filter-chip";
    button.dataset.filter = key;
    const shown = state[key];
    button.textContent = `${labels[key]}: ${shown}`;
    const close = document.createElement("span");
    close.textContent = "×";
    close.setAttribute("aria-hidden", "true");
    button.appendChild(close);
    button.setAttribute("aria-label", `Verwijder filter ${labels[key]} ${shown}`);
    fragment.appendChild(button);
  });
  el["active-filters"].replaceChildren(fragment);
}

function renderPagination(pageCount) {
  if (pageCount <= 1) {
    el.pagination.replaceChildren();
    return;
  }
  const pages = pageWindow(state.page, pageCount);
  let html = `<button data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""} aria-label="Vorige pagina">←</button>`;
  let previous = 0;
  pages.forEach((page) => {
    if (previous && page > previous + 1) html += '<span class="ellipsis" aria-hidden="true">…</span>';
    html += `<button class="page-number" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ""} aria-label="Pagina ${page}">${page}</button>`;
    previous = page;
  });
  html += `<button data-page="${state.page + 1}" ${state.page === pageCount ? "disabled" : ""} aria-label="Volgende pagina">→</button>`;
  el.pagination.innerHTML = html;
}

function pageWindow(current, total) {
  return [...new Set([1, total, current - 2, current - 1, current, current + 1, current + 2])]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
}

function showDetails(index) {
  const book = state.books.find((item) => item.index === index);
  if (!book) return;
  const row = book.row;
  const details = [
    ["Jaar", row[fields.year]],
    ["Taal", row[fields.language]],
    ["Categorie", row[fields.category]],
    ["Fiche", row[fields.card]],
    ["Uitgever", row[fields.publisher]],
    ["Inventarisnummer", row[fields.inventoryNumber]],
    ["Notities", row[fields.notes]],
  ].filter(([, value]) => normalize(value));

  el["dialog-content"].replaceChildren();
  const kicker = document.createElement("p");
  kicker.className = "dialog-kicker";
  kicker.textContent = normalize(row[fields.category]) || "Catalogusrecord";
  const title = document.createElement("h2");
  title.id = "dialog-title";
  title.textContent = normalize(row[fields.title]) || "Zonder titel";
  const author = document.createElement("p");
  author.className = "dialog-author";
  author.textContent = normalize(row[fields.author]) || "Auteur onbekend";
  const list = document.createElement("dl");
  list.className = "detail-grid";
  details.forEach(([label, value]) => {
    const group = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    group.append(term, description);
    list.appendChild(group);
  });
  el["dialog-content"].append(kicker, title, author, list);
  el["book-dialog"].showModal();
}

function hasFilters() {
  return Boolean(state.query || state.category || state.language || state.sort !== "title");
}

function clearFilters() {
  Object.assign(state, { query: "", category: "", language: "", sort: "title", page: 1 });
  el.search.value = "";
  ["category", "language"].forEach((key) => { el[key].value = ""; });
  el.sort.value = "title";
  applyFilters();
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.category) params.set("categorie", state.category);
  if (state.language) params.set("taal", state.language);
  if (state.sort !== "title") params.set("sort", state.sort);
  const url = `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`;
  history.replaceState(null, "", url);
}

function restoreUrlState() {
  const params = new URLSearchParams(location.search);
  state.query = params.get("q") || "";
  state.category = params.get("categorie") || "";
  state.language = params.get("taal") || "";
  state.sort = params.get("sort") || "title";
  el.search.value = state.query;
  ["category", "language", "sort"].forEach((key) => {
    if ([...el[key].options].some((option) => option.value === state[key])) el[key].value = state[key];
    else state[key] = key === "sort" ? "title" : "";
  });
}
