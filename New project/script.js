const STORAGE_KEY = "media-timeline-entries";
const TYPE_CONFIG = {
  book: {
    label: "書籍",
    metaLabel: "作者",
    side: "left",
    fallbackLabel: "Book Cover"
  },
  movie: {
    label: "電影",
    metaLabel: "導演",
    side: "right",
    fallbackLabel: "Movie Poster"
  },
  series: {
    label: "影集",
    metaLabel: "主創",
    side: "right",
    fallbackLabel: "Series Poster"
  }
};
const SERIES_CREW_PRIORITY = ["Creator", "Developer", "Writer", "Executive Producer"];

const sampleEntries = [
  {
    id: crypto.randomUUID(),
    type: "book",
    title: "小王子",
    creator: "安托万·德·圣埃克苏佩里",
    coverUrl: "",
    date: "2026-04-01",
    rating: 5,
    tags: ["成長", "寓言", "重讀"],
    note: "文字很輕，但會把一些成年之後忽略掉的東西重新放回眼前。"
  },
  {
    id: crypto.randomUUID(),
    type: "movie",
    title: "花樣年華",
    creator: "王家卫",
    coverUrl: "",
    date: "2026-03-23",
    rating: 5,
    tags: ["愛情", "氛圍", "香港"],
    note: "節制和克制比直接表達更有力量，很多情緒都停在轉身之前。"
  },
  {
    id: crypto.randomUUID(),
    type: "series",
    title: "請回答 1988",
    creator: "申源浩",
    coverUrl: "",
    date: "2026-02-18",
    rating: 5,
    tags: ["群像", "家庭", "懷舊"],
    note: "溫柔不是靠說教完成的，而是藏在每一個彼此照顧的生活細節裡。"
  },
  {
    id: crypto.randomUUID(),
    type: "book",
    title: "悉达多",
    creator: "赫尔曼·黑塞",
    coverUrl: "",
    date: "2026-02-11",
    rating: 4,
    tags: ["哲思", "自我探索"],
    note: "適合在人生卡住的時候讀，像是一次慢下來的內部對話。"
  }
];

const initialEntries = loadEntries();
const state = {
  entries: initialEntries,
  filter: "all",
  editingId: null,
  draftCoverUrl: "",
  creatorTouched: false,
  internalUpdate: false,
  lookupTimer: null,
  lookupRequestId: 0,
  quote: buildHeroQuote(initialEntries)
};

const form = document.querySelector("#entry-form");
const timelineList = document.querySelector("#timeline-list");
const itemTemplate = document.querySelector("#timeline-item-template");
const filterRoot = document.querySelector("#type-filter");
const clearButton = document.querySelector("#clear-all");
const titleInput = form.elements.title;
const creatorInput = form.elements.creator;
const manualCoverInput = form.elements.manualCoverUrl;
const noteInput = form.elements.note;
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit");
const cancelEditSecondaryButton = document.querySelector("#cancel-edit-secondary");
const editingBar = document.querySelector("#editing-bar");
const editingLabel = document.querySelector("#editing-label");
const lookupStatus = document.querySelector("#lookup-status");
const previewMedia = document.querySelector("#cover-preview-media");
const previewImage = document.querySelector("#cover-preview-image");
const previewFallback = document.querySelector("#cover-preview-fallback");
const previewKicker = document.querySelector("#cover-preview-kicker");
const previewTitle = document.querySelector("#cover-preview-title");
const previewCaption = document.querySelector("#cover-preview-caption");
const heroQuote = document.querySelector("#hero-quote");
const heroAttribution = document.querySelector("#hero-attribution");
const typeInputs = Array.from(document.querySelectorAll('input[name="type"]'));

form.date.value = new Date().toISOString().slice(0, 10);
syncFormPlaceholders();
updatePreview();
render();

form.addEventListener("submit", handleSubmit);
titleInput.addEventListener("input", () => {
  if (state.editingId) {
    updateFormMode();
  }

  state.draftCoverUrl = "";
  updatePreview();
  scheduleMetadataLookup();
});
titleInput.addEventListener("blur", () => scheduleMetadataLookup(true));
creatorInput.addEventListener("input", () => {
  if (!state.internalUpdate) {
    state.creatorTouched = true;
    if (titleInput.value.trim()) {
      scheduleMetadataLookup();
    }
  }
});
manualCoverInput.addEventListener("input", () => {
  state.draftCoverUrl = String(manualCoverInput.value || "").trim();
  updatePreview();
});

typeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    state.draftCoverUrl = String(manualCoverInput.value || "").trim();
    syncFormPlaceholders();
    updatePreview();
    scheduleMetadataLookup(true);
  });
});

filterRoot.addEventListener("click", (event) => {
  const target = event.target.closest("[data-filter]");
  if (!target) return;

  state.filter = target.dataset.filter;
  renderFilters();
  renderTimeline();
});

timelineList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".card-delete-btn");
  if (deleteButton) {
    const entry = state.entries.find((item) => item.id === deleteButton.dataset.id);
    if (!entry) return;

    const shouldDelete = window.confirm(`確定要刪除《${entry.title}》嗎？`);
    if (!shouldDelete) return;

    state.entries = state.entries.filter((item) => item.id !== entry.id);
    state.quote = buildHeroQuote(state.entries);
    persistEntries();

    if (state.editingId === entry.id) {
      cancelEditing(true);
    }

    render();
    return;
  }

  const editButton = event.target.closest(".card-edit-btn");
  if (!editButton) return;

  const entry = state.entries.find((item) => item.id === editButton.dataset.id);
  if (!entry) return;

  startEditing(entry);
});

clearButton.addEventListener("click", () => {
  const shouldReset = window.confirm("確定要清空目前瀏覽器中的記錄，並恢復示例資料嗎？");
  if (!shouldReset) return;

  localStorage.removeItem(STORAGE_KEY);
  state.entries = sampleEntries.map(cloneEntry).sort(sortByDateDesc);
  state.quote = buildHeroQuote(state.entries);
  persistEntries();
  cancelEditing(true);
  render();
});

cancelEditButton.addEventListener("click", () => cancelEditing(false));
cancelEditSecondaryButton.addEventListener("click", () => cancelEditing(false));

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(form);
  const type = normalizeType(formData.get("type"));
  const title = String(formData.get("title") || "").trim();
  const note = String(formData.get("note") || "").trim();
  const creatorValue = String(formData.get("creator") || "").trim();
  const manualCoverUrl = String(formData.get("manualCoverUrl") || "").trim();
  let coverUrl = manualCoverUrl || state.draftCoverUrl;

  if (title && !coverUrl) {
    try {
      const metadata = await fetchMetadata(type, title, creatorValue);
      coverUrl = metadata.coverUrl || "";

      if (metadata.creator && !creatorValue) {
        withInternalUpdate(() => {
          creatorInput.value = metadata.creator;
        });
      }
    } catch (error) {
      console.warn("Metadata lookup failed during submit.", error);
    }
  }

  const entry = normalizeEntry({
    id: state.editingId || crypto.randomUUID(),
    type,
    title,
    creator: creatorInput.value,
    coverUrl,
    date: formData.get("date"),
    rating: formData.get("rating"),
    tags: String(formData.get("tags"))
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    note
  });

  if (state.editingId) {
    state.entries = state.entries
      .map((item) => (item.id === state.editingId ? entry : item))
      .sort(sortByDateDesc);
  } else {
    state.entries = [entry, ...state.entries].sort(sortByDateDesc);
  }

  state.quote = buildHeroQuote(state.entries);
  persistEntries();
  cancelEditing(true);
  render();
}

function loadEntries() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleEntries));
    return sampleEntries.map(cloneEntry).sort(sortByDateDesc);
  }

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      throw new Error("Invalid storage data");
    }

    return parsed.map(normalizeEntry).sort(sortByDateDesc);
  } catch (error) {
    console.warn("Failed to parse saved entries, using sample data instead.", error);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleEntries));
    return sampleEntries.map(cloneEntry).sort(sortByDateDesc);
  }
}

function persistEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function render() {
  renderHero();
  renderStats();
  renderFilters();
  renderTimeline();
}

function renderHero() {
  heroQuote.textContent = state.quote.text;
  heroAttribution.textContent = state.quote.attribution;
}

function renderStats() {
  const books = state.entries.filter((entry) => entry.type === "book").length;
  const movies = state.entries.filter((entry) => entry.type === "movie").length;
  const series = state.entries.filter((entry) => entry.type === "series").length;

  document.querySelector("#count-all").textContent = String(state.entries.length);
  document.querySelector("#count-books").textContent = String(books);
  document.querySelector("#count-movies").textContent = String(movies);
  document.querySelector("#count-series").textContent = String(series);
}

function renderFilters() {
  filterRoot.querySelectorAll(".filter-chip").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });
}

function renderTimeline() {
  const entries = state.entries.filter((entry) => state.filter === "all" || entry.type === state.filter);

  timelineList.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
      <h3>這個分類下還沒有內容</h3>
      <p>先新增一條記錄，這條時間流就會開始延伸。</p>
    `;
    timelineList.append(empty);
    return;
  }

  entries.forEach((entry, index) => {
    const fragment = itemTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".timeline-card");
    const typeConfig = getTypeConfig(entry.type);
    const date = new Date(entry.date);
    const cover = fragment.querySelector(".card-cover");
    const fallback = fragment.querySelector(".card-cover-fallback");
    const editButton = fragment.querySelector(".card-edit-btn");

    card.dataset.type = entry.type;
    card.dataset.side = typeConfig.side;
    card.style.animationDelay = `${index * 60}ms`;

    fragment.querySelector(".card-year").textContent = String(date.getFullYear());
    fragment.querySelector(".card-date").textContent = formatDate(entry.date);
    fragment.querySelector(".card-type").textContent = typeConfig.label;
    fragment.querySelector(".card-rating").textContent = `${"★".repeat(entry.rating)} ${entry.rating}.0`;
    fragment.querySelector(".card-title").textContent = entry.title;
    fragment.querySelector(".card-meta").textContent = `${typeConfig.metaLabel}：${entry.creator || "待補充"}`;
    fragment.querySelector(".card-note").textContent = entry.note;
    fragment.querySelector(".fallback-kicker").textContent = typeConfig.fallbackLabel;
    fragment.querySelector(".fallback-title").textContent = entry.title;
    editButton.dataset.id = entry.id;
    fragment.querySelector(".card-delete-btn").dataset.id = entry.id;

    if (entry.coverUrl) {
      cover.src = entry.coverUrl;
      cover.alt = `${entry.title}封面`;
      cover.hidden = false;
      fallback.hidden = true;
      cover.addEventListener("error", () => {
        cover.hidden = true;
        fallback.hidden = false;
      });
    } else {
      cover.hidden = true;
      fallback.hidden = false;
    }

    const tagsRoot = fragment.querySelector(".card-tags");
    if (entry.tags.length) {
      entry.tags.forEach((tag) => {
        const tagElement = document.createElement("span");
        tagElement.textContent = tag;
        tagsRoot.append(tagElement);
      });
    } else {
      tagsRoot.remove();
    }

    timelineList.append(fragment);
  });
}

function startEditing(entry) {
  state.editingId = entry.id;
  state.draftCoverUrl = entry.coverUrl || "";
  state.creatorTouched = false;

  withInternalUpdate(() => {
    form.elements.type.value = entry.type;
    titleInput.value = entry.title;
    creatorInput.value = entry.creator;
    manualCoverInput.value = entry.coverUrl || "";
    form.elements.date.value = entry.date;
    form.elements.rating.value = String(entry.rating);
    form.elements.tags.value = entry.tags.join(", ");
    noteInput.value = entry.note;
  });

  syncFormPlaceholders();
  updatePreview(entry.title);
  setLookupStatus("你可以直接修改資料，標題變化後會重新自動帶入。");
  updateFormMode();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelEditing(silent) {
  state.editingId = null;
  state.draftCoverUrl = "";
  state.creatorTouched = false;
  clearTimeout(state.lookupTimer);
  state.lookupRequestId += 1;

  form.reset();
  form.date.value = new Date().toISOString().slice(0, 10);
  document.querySelector("#type-book").checked = true;
  syncFormPlaceholders();
  updatePreview();
  updateFormMode();

  if (!silent) {
    setLookupStatus("已退出編輯，繼續新增記錄。");
  } else {
    setLookupStatus("");
  }
}

function updateFormMode() {
  const isEditing = Boolean(state.editingId);
  editingBar.hidden = !isEditing;
  cancelEditSecondaryButton.hidden = !isEditing;
  submitButton.textContent = isEditing ? "儲存修改" : "加入時間流";

  if (isEditing) {
    editingLabel.textContent = `正在編輯：《${titleInput.value || "未命名"}》`;
  }
}

function syncFormPlaceholders() {
  const type = getSelectedType();

  if (type === "book") {
    titleInput.placeholder = "例如：小王子 / 佩德羅·巴拉莫";
    creatorInput.placeholder = "輸入標題後自動帶入作者，也可手動修改";
    noteInput.placeholder = "寫下閱讀之後最直接的一句感受。";
    return;
  }

  if (type === "series") {
    titleInput.placeholder = "例如：請回答 1988 / 黑鏡";
    creatorInput.placeholder = "輸入標題後自動帶入主創，也可手動修改";
    noteInput.placeholder = "寫下追完之後最留下來的情緒或印象。";
    return;
  }

  titleInput.placeholder = "例如：花樣年華 / 機器人之夢";
  creatorInput.placeholder = "輸入標題後自動帶入導演，也可手動修改";
  noteInput.placeholder = "寫下看完電影後最直接的一句感受。";
}

function scheduleMetadataLookup(immediate) {
  clearTimeout(state.lookupTimer);

  if (!titleInput.value.trim()) {
    state.draftCoverUrl = "";
    updatePreview();
    setLookupStatus("");
    return;
  }

  if (immediate) {
    void lookupMetadataForCurrentTitle();
    return;
  }

  state.lookupTimer = window.setTimeout(() => {
    void lookupMetadataForCurrentTitle();
  }, 500);
}

async function lookupMetadataForCurrentTitle() {
  const title = titleInput.value.trim();
  if (!title) return;

  const type = getSelectedType();
  const creatorHint = creatorInput.value.trim();
  const requestId = ++state.lookupRequestId;
  setLookupStatus("正在自動查詢資料...", "loading");

  try {
    const metadata = await fetchMetadata(type, title, creatorHint);
    if (requestId !== state.lookupRequestId) return;

    if (manualCoverInput.value.trim()) {
      state.draftCoverUrl = manualCoverInput.value.trim();
    } else if (metadata.coverUrl) {
      state.draftCoverUrl = metadata.coverUrl;
    } else {
      state.draftCoverUrl = "";
    }

    if (metadata.creator && (!state.creatorTouched || !creatorInput.value.trim())) {
      withInternalUpdate(() => {
        creatorInput.value = metadata.creator;
      });
      state.creatorTouched = false;
    }

    updatePreview(title);

    if (metadata.coverUrl || metadata.creator) {
      const sourceText = metadata.coverUrl && metadata.creator ? "封面與資訊" : metadata.coverUrl ? "封面" : "作者 / 導演 / 主創";
      setLookupStatus(`已自動帶入${sourceText}。`);
    } else {
      setLookupStatus("沒有找到可直接帶入的資料，將維持預設封面。");
    }
  } catch (error) {
    if (requestId !== state.lookupRequestId) return;

    console.warn("Metadata lookup failed.", error);
    updatePreview(title);
    setLookupStatus("自動查詢失敗，可繼續手動填寫作者 / 導演 / 主創。", "error");
  }
}

async function fetchMetadata(type, title, creatorHint = "") {
  if (type === "book") {
    return fetchBookMetadata(title, creatorHint);
  }

  if (type === "series") {
    return fetchSeriesMetadata(title);
  }

  return fetchMovieMetadata(title);
}

async function fetchBookMetadata(title, creatorHint = "") {
  try {
    const douban = await fetchDoubanBookMetadata(title, creatorHint);
    if (douban.coverUrl || douban.creator) {
      return douban;
    }
  } catch (error) {
    console.warn("Douban lookup failed.", error);
  }

  const searchParams = new URLSearchParams({
    title,
    limit: "5"
  });

  if (creatorHint) {
    searchParams.set("author", creatorHint);
  }

  const data = await fetchJson(`https://openlibrary.org/search.json?${searchParams.toString()}`);
  const items = Array.isArray(data.docs) ? data.docs : [];
  const best = pickBestBookMatch(
    items,
    title,
    creatorHint,
    (item) => item?.title || "",
    (item) => item?.author_name || []
  );

  if (!best) {
    try {
      return await fetchGoogleBooksMetadata(title, creatorHint);
    } catch (error) {
      console.warn("Google Books lookup failed.", error);
      return emptyMetadata();
    }
  }

  return {
    creator: Array.isArray(best.author_name) ? best.author_name.join(" / ") : "",
    coverUrl: normalizeOpenLibraryCover(best)
  };
}

async function fetchMovieMetadata(title) {
  const searchTerms = buildMovieSearchTerms(title);

  for (const term of searchTerms) {
    const data = await fetchJsonp(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=us&media=movie&entity=movie&limit=8`
    );
    const results = Array.isArray(data.results) ? data.results : [];
    const best = pickBestMovieMatch(results, title, term, (item) => item.trackName || item.collectionName || "");

    if (!best) {
      continue;
    }

    return {
      creator: String(best.artistName || "").trim(),
      coverUrl: normalizeItunesArtwork(best.artworkUrl100 || best.artworkUrl60 || "")
    };
  }

  return emptyMetadata();
}

async function fetchSeriesMetadata(title) {
  const results = await fetchJson(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(title)}`);
  const shows = Array.isArray(results) ? results.map((item) => item.show).filter(Boolean) : [];
  const best = pickBestMatch(shows, title, (show) => show.name || "");

  if (!best) {
    return emptyMetadata();
  }

  let creator = "";

  if (best.id) {
    const crew = await fetchJson(`https://api.tvmaze.com/shows/${best.id}/crew`);
    creator = extractSeriesCreator(crew);
  }

  return {
    creator,
    coverUrl: best.image?.original || best.image?.medium || ""
  };
}

function extractSeriesCreator(crew) {
  if (!Array.isArray(crew) || !crew.length) {
    return "";
  }

  const byPriority = SERIES_CREW_PRIORITY.flatMap((role) =>
    crew
      .filter((item) => item.type === role && item.person?.name)
      .map((item) => item.person.name)
  );
  const unique = [...new Set(byPriority.length ? byPriority : crew.filter((item) => item.person?.name).map((item) => item.person.name))];

  return unique.slice(0, 2).join(" / ");
}

function pickBestMatch(items, title, accessor) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const normalizedTitle = normalizeSearchText(title);
  const exact = items.find((item) => normalizeSearchText(accessor(item)) === normalizedTitle);
  if (exact) return exact;

  const partial = items.find((item) => normalizeSearchText(accessor(item)).includes(normalizedTitle));
  return partial || items[0];
}

function pickBestBookMatch(items, title, creatorHint, titleAccessor, authorsAccessor) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const normalizedTitle = normalizeSearchText(title);
  const normalizedCreator = normalizeSearchText(creatorHint);

  const scoredItems = items
    .map((item) => {
      const itemTitle = normalizeSearchText(titleAccessor(item));
      const authors = authorsAccessor(item)
        .map((author) => normalizeSearchText(author))
        .filter(Boolean);

      let score = 0;

      if (itemTitle === normalizedTitle) {
        score += 6;
      } else if (itemTitle.includes(normalizedTitle) || normalizedTitle.includes(itemTitle)) {
        score += 4;
      }

      if (normalizedCreator) {
        const authorMatched = authors.some(
          (author) => author === normalizedCreator || author.includes(normalizedCreator) || normalizedCreator.includes(author)
        );

        if (authorMatched) {
          score += 5;
        }
      }

      if (item.cover_i || item.image || item.images?.large || item.images?.medium) {
        score += 1;
      }

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scoredItems[0]?.item || null;
}

function normalizeOpenLibraryCover(item) {
  if (item?.cover_i) {
    return `https://covers.openlibrary.org/b/id/${item.cover_i}-L.jpg`;
  }

  if (Array.isArray(item?.isbn) && item.isbn.length) {
    return `https://covers.openlibrary.org/b/isbn/${item.isbn[0]}-L.jpg`;
  }

  return "";
}

async function fetchGoogleBooksMetadata(title, creatorHint = "") {
  const query = creatorHint ? `intitle:${title}+inauthor:${creatorHint}` : `intitle:${title}`;
  const data = await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&printType=books`
  );
  const items = Array.isArray(data.items) ? data.items : [];
  const best = pickBestBookMatch(
    items,
    title,
    creatorHint,
    (item) => item?.volumeInfo?.title || "",
    (item) => item?.volumeInfo?.authors || []
  );

  if (!best) {
    return emptyMetadata();
  }

  const info = best.volumeInfo || {};
  return {
    creator: Array.isArray(info.authors) ? info.authors.join(" / ") : "",
    coverUrl: normalizeGoogleBooksCover(info.imageLinks || {})
  };
}

function normalizeGoogleBooksCover(imageLinks) {
  const raw =
    imageLinks.extraLarge ||
    imageLinks.large ||
    imageLinks.medium ||
    imageLinks.thumbnail ||
    imageLinks.smallThumbnail ||
    "";

  return String(raw).replace("http://", "https://").replace("&edge=curl", "");
}

async function fetchDoubanBookMetadata(title, creatorHint = "") {
  const query = creatorHint ? `${title} ${creatorHint}` : title;
  const data = await fetchJsonp(
    `https://api.douban.com/v2/book/search?q=${encodeURIComponent(query)}&count=5`
  );
  const items = Array.isArray(data.books) ? data.books : [];
  const best = pickBestBookMatch(
    items,
    title,
    creatorHint,
    (item) => item?.title || "",
    (item) => item?.author || []
  );

  if (!best) {
    return emptyMetadata();
  }

  return {
    creator: Array.isArray(best.author) ? best.author.join(" / ") : "",
    coverUrl: normalizeDoubanCover(best.image || best.images?.large || best.images?.medium || "")
  };
}

function normalizeDoubanCover(url) {
  return String(url || "").replace("http://", "https://");
}

function normalizeItunesArtwork(url) {
  return String(url).replace(/\/[0-9]+x[0-9]+bb\./, "/600x600bb.");
}

function buildMovieSearchTerms(title) {
  const terms = [];
  const base = String(title || "").trim();
  if (!base) {
    return terms;
  }

  const cleaned = base.replace(/^(the|a|an|captain|mr|mrs|ms|dr|doctor|professor)\s+/i, "").trim();
  const withoutSuffix = cleaned.replace(/\s+\([^)]*\)$/, "").trim();
  const words = withoutSuffix.split(/\s+/).filter(Boolean);

  terms.push(base);

  if (cleaned && cleaned !== base) {
    terms.push(cleaned);
  }

  if (withoutSuffix && withoutSuffix !== cleaned) {
    terms.push(withoutSuffix);
  }

  if (words.length > 1) {
    terms.push(words[words.length - 1]);
  }

  return [...new Set(terms.filter(Boolean))];
}

function pickBestMovieMatch(items, originalTitle, searchedTerm, accessor) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const normalizedOriginal = normalizeSearchText(originalTitle);
  const normalizedSearch = normalizeSearchText(searchedTerm);

  const scoredItems = items
    .map((item) => {
      const itemTitle = normalizeSearchText(accessor(item));
      let score = 0;

      if (itemTitle === normalizedOriginal) {
        score += 6;
      } else if (itemTitle === normalizedSearch) {
        score += 5;
      } else if (itemTitle.includes(normalizedOriginal) || normalizedOriginal.includes(itemTitle)) {
        score += 4;
      } else if (itemTitle.includes(normalizedSearch) || normalizedSearch.includes(itemTitle)) {
        score += 3;
      }

      if (item.artworkUrl100 || item.artworkUrl60) {
        score += 1;
      }

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scoredItems[0]?.score > 0 ? scoredItems[0].item : null;
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s"'`~!@#$%^&*()_+\-=[\]{};:\\|,.<>/?，。、《》？；：‘’“”（）【】]/g, "");
}

function emptyMetadata() {
  return {
    creator: "",
    coverUrl: ""
  };
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function fetchJsonp(url) {
  return new Promise((resolve, reject) => {
    const callbackName = `bookLookup_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("JSONP request timed out"));
    }, 6000);

    function cleanup() {
      window.clearTimeout(timeoutId);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (payload) => {
      cleanup();
      resolve(payload);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP request failed"));
    };

    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=${callbackName}`;
    document.body.append(script);
  });
}

function normalizeEntry(entry) {
  const type = normalizeType(entry.type);

  return {
    id: entry.id || crypto.randomUUID(),
    type,
    title: String(entry.title || "").trim(),
    creator: String(entry.creator || "").trim(),
    coverUrl: String(entry.coverUrl || "").trim(),
    date: normalizeDate(entry.date),
    rating: clampRating(entry.rating),
    tags: Array.isArray(entry.tags)
      ? entry.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    note: String(entry.note || "").trim()
  };
}

function cloneEntry(entry) {
  return normalizeEntry(structuredClone(entry));
}

function normalizeType(type) {
  if (type === "movie" || type === "series") {
    return type;
  }

  return "book";
}

function normalizeDate(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return new Date().toISOString().slice(0, 10);
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return raw.slice(0, 10);
}

function getSelectedType() {
  return normalizeType(form.elements.type.value);
}

function getTypeConfig(type) {
  return TYPE_CONFIG[normalizeType(type)];
}

function sortByDateDesc(a, b) {
  return new Date(b.date) - new Date(a.date);
}

function clampRating(value) {
  const rating = Number(value);

  if (Number.isNaN(rating)) {
    return 3;
  }

  return Math.min(5, Math.max(1, Math.round(rating)));
}

function formatDate(dateString) {
  const date = new Date(dateString);

  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric"
  }).format(date);
}

function setLookupStatus(message, stateName) {
  lookupStatus.textContent = message;
  if (stateName) {
    lookupStatus.dataset.state = stateName;
  } else {
    delete lookupStatus.dataset.state;
  }
}

function updatePreview(titleValue) {
  const typeConfig = getTypeConfig(getSelectedType());
  const title = titleValue || titleInput.value.trim() || "等待自動帶入";

  previewMedia.dataset.type = getSelectedType();
  previewKicker.textContent = typeConfig.fallbackLabel;
  previewTitle.textContent = title;

  if (state.draftCoverUrl) {
    previewImage.src = state.draftCoverUrl;
    previewImage.alt = `${title}封面預覽`;
    previewImage.hidden = false;
    previewFallback.hidden = true;
    previewCaption.textContent = "已自動帶入封面；如果資料有誤，可以在儲存後再編輯修正。";
    previewImage.onerror = () => {
      previewImage.hidden = true;
      previewFallback.hidden = false;
      previewCaption.textContent = "沒有找到穩定封面來源，將使用預設封面樣式。";
    };
    return;
  }

  previewImage.hidden = true;
  previewFallback.hidden = false;
  previewCaption.textContent = "輸入標題後會自動帶入封面，找不到時維持預設樣式。";
}

function withInternalUpdate(callback) {
  state.internalUpdate = true;
  callback();
  state.internalUpdate = false;
}

function buildHeroQuote(entries) {
  if (!entries.length) {
    return {
      text: "有些作品結束得很快，卻會在很久以後，才慢慢顯出它留下的回聲。",
      attribution: "從你的時間流開始，慢慢累積這句回聲。"
    };
  }

  const entry = entries[Math.floor(Math.random() * entries.length)];
  const noteSeed = trimEndingPunctuation(entry.note) || `《${entry.title}》總會在某個時刻重新回來。`;
  const typeLabel = getTypeConfig(entry.type).label;
  const templates = [
    `《${entry.title}》之後才明白，${noteSeed}。`,
    `真正留下來的，往往不是情節本身，而是《${entry.title}》讓人遲遲說不清的那點餘味。`,
    `有些${entry.type === "book" ? "句子" : "鏡頭"}並不會立刻發亮，像《${entry.title}》這樣，常常要隔一段時間才慢慢抵達。`,
    `時間把許多細節帶走，卻會把《${entry.title}》裡最安靜的那一部分，悄悄留下來。`
  ];

  return {
    text: templates[Math.floor(Math.random() * templates.length)],
    attribution: `隨機取自你已經看過的${typeLabel}：《${entry.title}》`
  };
}

function trimEndingPunctuation(text) {
  return String(text || "").trim().replace(/[。！？.!?]+$/, "");
}
