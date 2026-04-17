const STORAGE_KEY = "media-timeline-entries";
const SUPABASE_CONFIG_KEY = "helen-archive-supabase-config";
const SUPABASE_TABLE = "timeline_entries";
const ADMIN_MODE = new URLSearchParams(window.location.search).get("admin") === "1";
const DEFAULT_SUPABASE_CONFIG = {
  url: "https://hdflbbxeasyicqrueqcs.supabase.co",
  anonKey: "sb_publishable_QUBpe5MKqft8uyq3z_cLzw_0IXSq7dV"
};
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

const BOOK_QUOTES = [
  {
    en: "Not all those who wander are lost.",
    zh: "并不是所有流浪的人，都迷失了方向。",
    title: "The Fellowship of the Ring",
    author: "J. R. R. Tolkien"
  },
  {
    en: "Whatever our souls are made of, his and mine are the same.",
    zh: "无论灵魂由什么构成，他的与我的，是同一种东西。",
    title: "Wuthering Heights",
    author: "Emily Bronte"
  },
  {
    en: "I am no bird; and no net ensnares me.",
    zh: "我不是鸟，也没有任何罗网能困住我。",
    title: "Jane Eyre",
    author: "Charlotte Bronte"
  },
  {
    en: "It is our choices that show what we truly are.",
    zh: "真正定义我们的，是我们所作的选择。",
    title: "Harry Potter and the Chamber of Secrets",
    author: "J. K. Rowling"
  },
  {
    en: "There is no greater agony than bearing an untold story inside you.",
    zh: "心里藏着一个未说出的故事，没有比这更深的痛苦了。",
    title: "I Know Why the Caged Bird Sings",
    author: "Maya Angelou"
  },
  {
    en: "Memories warm you up from the inside. But they also tear you apart.",
    zh: "回忆会从内部给你温度，也会从内部把你撕开。",
    title: "Kafka on the Shore",
    author: "Haruki Murakami"
  },
  {
    en: "And now that you don't have to be perfect, you can be good.",
    zh: "现在你不必再追求完美了，你终于可以变得真切而良善。",
    title: "East of Eden",
    author: "John Steinbeck"
  },
  {
    en: "I cannot live without my life! I cannot live without my soul!",
    zh: "没有我的生命，我活不下去；没有我的灵魂，我也活不下去。",
    title: "Wuthering Heights",
    author: "Emily Bronte"
  },
  {
    en: "The only way out of the labyrinth of suffering is to forgive.",
    zh: "走出痛苦迷宫的唯一方法，是宽恕。",
    title: "Looking for Alaska",
    author: "John Green"
  },
  {
    en: "All we have to decide is what to do with the time that is given us.",
    zh: "我们真正需要决定的，只是如何使用被给予我们的时间。",
    title: "The Fellowship of the Ring",
    author: "J. R. R. Tolkien"
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
  quote: buildHeroQuote(),
  storageMode: "local",
  syncClient: null,
  syncBusy: false,
  syncStatusMessage: "",
  syncStatusState: "",
  authSession: null,
  authSubscription: null,
  pendingImportEntries: initialEntries.map(cloneEntry),
  adminMode: ADMIN_MODE
};

const form = document.querySelector("#entry-form");
const entryPanel = document.querySelector("#entry-panel");
const syncPanel = document.querySelector("#sync-panel");
const timelineList = document.querySelector("#timeline-list");
const itemTemplate = document.querySelector("#timeline-item-template");
const filterRoot = document.querySelector("#type-filter");
const clearButton = document.querySelector("#clear-all");
const syncBadge = document.querySelector("#sync-badge");
const syncModeText = document.querySelector("#sync-mode-text");
const syncStatus = document.querySelector("#sync-status");
const supabaseUrlInput = document.querySelector("#supabase-url");
const supabaseKeyInput = document.querySelector("#supabase-anon-key");
const connectSupabaseButton = document.querySelector("#connect-supabase");
const refreshSupabaseButton = document.querySelector("#refresh-supabase");
const importLocalButton = document.querySelector("#import-local");
const disconnectSupabaseButton = document.querySelector("#disconnect-supabase");
const authPanel = document.querySelector("#auth-panel");
const authEmailInput = document.querySelector("#auth-email");
const sendMagicLinkButton = document.querySelector("#send-magic-link");
const signOutButton = document.querySelector("#sign-out");
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
document.body.dataset.adminMode = String(state.adminMode);
syncFormPlaceholders();
updatePreview();
render();
updateSyncUi();
void initializeSupabase();

form.addEventListener("submit", handleSubmit);
connectSupabaseButton.addEventListener("click", () => void handleConnectSupabase());
refreshSupabaseButton.addEventListener("click", () => void refreshEntriesFromCloud(true));
importLocalButton.addEventListener("click", () => void importPendingEntriesToCloud());
disconnectSupabaseButton.addEventListener("click", handleDisconnectSupabase);
sendMagicLinkButton.addEventListener("click", () => void handleSendMagicLink());
signOutButton.addEventListener("click", () => void handleSignOut());
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
    if (!ensureWritable()) return;

    const entry = state.entries.find((item) => item.id === deleteButton.dataset.id);
    if (!entry) return;

    const shouldDelete = window.confirm(`確定要刪除《${entry.title}》嗎？`);
    if (!shouldDelete) return;

    void deleteEntry(entry);
    return;
  }

  const editButton = event.target.closest(".card-edit-btn");
  if (!editButton) return;

  if (!ensureWritable()) return;

  const entry = state.entries.find((item) => item.id === editButton.dataset.id);
  if (!entry) return;

  startEditing(entry);
});

clearButton.addEventListener("click", () => {
  if (!ensureWritable()) return;

  const resetMessage =
    state.storageMode === "supabase"
      ? "確定要清空雲端資料，並恢復示例資料嗎？"
      : "確定要清空目前瀏覽器中的記錄，並恢復示例資料嗎？";
  const shouldReset = window.confirm(resetMessage);
  if (!shouldReset) return;

  void resetEntries();
});

cancelEditButton.addEventListener("click", () => cancelEditing(false));
cancelEditSecondaryButton.addEventListener("click", () => cancelEditing(false));

async function handleSubmit(event) {
  event.preventDefault();
  if (!ensureWritable()) return;

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

  state.quote = buildHeroQuote();
  try {
    await persistEntry(entry);
  } catch (error) {
    return;
  }
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
  if (state.storageMode === "local") {
    state.pendingImportEntries = state.entries.map(cloneEntry);
  }
}

async function persistEntry(entry) {
  if (state.storageMode === "supabase" && state.syncClient) {
    const { error } = await state.syncClient.from(SUPABASE_TABLE).upsert(serializeEntry(entry));
    if (error) {
      console.error(error);
      setSyncStatus("雲端儲存失敗，這次修改沒有成功寫入 Supabase。", "error");
      throw error;
    }

    setSyncStatus("已同步到雲端。");
  }

  persistEntries();
}

async function deleteEntry(entry) {
  if (state.storageMode === "supabase" && state.syncClient) {
    const { error } = await state.syncClient.from(SUPABASE_TABLE).delete().eq("id", entry.id);
    if (error) {
      console.error(error);
      setSyncStatus("刪除雲端資料失敗，請稍後再試。", "error");
      return;
    }

    setSyncStatus("已從雲端刪除。");
  }

  state.entries = state.entries.filter((item) => item.id !== entry.id);
  state.quote = buildHeroQuote();
  persistEntries();

  if (state.editingId === entry.id) {
    cancelEditing(true);
  }

  render();
}

async function resetEntries() {
  const nextEntries = sampleEntries.map(cloneEntry).sort(sortByDateDesc);

  if (state.storageMode === "supabase" && state.syncClient) {
    const { error: deleteError } = await state.syncClient.from(SUPABASE_TABLE).delete().neq("id", "");
    if (deleteError) {
      console.error(deleteError);
      setSyncStatus("重設雲端資料失敗，請稍後再試。", "error");
      return;
    }

    const { error: insertError } = await state.syncClient
      .from(SUPABASE_TABLE)
      .insert(nextEntries.map((entry) => serializeEntry(entry)));
    if (insertError) {
      console.error(insertError);
      setSyncStatus("示例資料回寫到雲端失敗。", "error");
      return;
    }

    setSyncStatus("已用示例資料重設雲端。");
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }

  state.entries = nextEntries;
  state.pendingImportEntries = nextEntries.map(cloneEntry);
  state.quote = buildHeroQuote();
  persistEntries();
  cancelEditing(true);
  render();
}

function render() {
  renderHero();
  renderStats();
  renderFilters();
  renderTimeline();
  updateSyncUi();
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
  const canWrite = canWriteEntries();

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
    editButton.disabled = !canWrite;
    editButton.hidden = !state.adminMode;
    fragment.querySelector(".card-delete-btn").dataset.id = entry.id;
    fragment.querySelector(".card-delete-btn").disabled = !canWrite;
    fragment.querySelector(".card-delete-btn").hidden = !state.adminMode;

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
  if (!canWriteEntries()) {
    setSyncStatus("目前是雲端唯讀模式，請先登入後再編輯。", "error");
    return;
  }

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

async function initializeSupabase() {
  const config = readSupabaseConfig();
  if (!config) {
    setSyncStatus("目前使用本機儲存。完成 Supabase 設定後，記錄就能跨裝置同步。");
    return;
  }

  supabaseUrlInput.value = config.url;
  supabaseKeyInput.value = config.anonKey;
  await connectToSupabase(config, true);
}

async function handleConnectSupabase() {
  const config = {
    url: String(supabaseUrlInput.value || "").trim(),
    anonKey: String(supabaseKeyInput.value || "").trim()
  };

  await connectToSupabase(config, false);
}

async function connectToSupabase(config, silent) {
  if (!config.url || !config.anonKey) {
    setSyncStatus("先填入 Supabase URL 和 anon key。", "error");
    return;
  }

  if (!window.supabase?.createClient) {
    setSyncStatus("Supabase 載入失敗，請重新整理頁面。", "error");
    return;
  }

  const localSnapshot = loadEntries().map(cloneEntry);
  setSyncBusy(true);
  setSyncStatus("正在連接 Supabase...", "loading");

  try {
    const client = window.supabase.createClient(config.url, config.anonKey);
    bindAuthListener(client);

    const {
      data: { session },
      error: sessionError
    } = await client.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }

    const remoteEntries = await fetchSupabaseEntries(client);

    state.syncClient = client;
    state.storageMode = "supabase";
    state.authSession = session;
    state.pendingImportEntries = localSnapshot;

    saveSupabaseConfig(config);

    if (remoteEntries.length) {
      state.entries = remoteEntries;
      state.quote = buildHeroQuote();
      persistEntries();
      setSyncStatus(session ? "已連接雲端，且目前已登入。" : "已連接雲端，目前為唯讀模式；登入後可編輯。");
    } else if (localSnapshot.length) {
      state.entries = localSnapshot.sort(sortByDateDesc);
      state.quote = buildHeroQuote();
      persistEntries();
      setSyncStatus(
        session
          ? "雲端目前還是空的，你可以把目前這個瀏覽器的記錄上傳上去。"
          : "雲端目前是空的；先登入，再把目前瀏覽器的記錄上傳到雲端。"
      );
    } else {
      state.entries = [];
      state.quote = buildHeroQuote();
      persistEntries();
      setSyncStatus(session ? "已連接雲端，目前還沒有任何記錄。" : "已連接雲端，目前還沒有任何記錄；登入後即可新增。");
    }

    if (!silent) {
      render();
    } else {
      render();
    }
  } catch (error) {
    console.error(error);
    setSyncStatus("連接 Supabase 失敗。請確認 URL、anon key 與資料表設定。", "error");
  } finally {
    setSyncBusy(false);
  }
}

function handleDisconnectSupabase() {
  if (state.authSubscription) {
    state.authSubscription.unsubscribe();
    state.authSubscription = null;
  }

  state.syncClient = null;
  state.storageMode = "local";
  state.authSession = null;
  clearSupabaseConfig();
  setSyncStatus("已切回本機儲存模式。");
  render();
}

async function handleSendMagicLink() {
  if (!state.syncClient) {
    setSyncStatus("請先連接 Supabase。", "error");
    return;
  }

  const email = String(authEmailInput.value || "").trim();
  if (!email) {
    setSyncStatus("先填入你的管理用信箱。", "error");
    return;
  }

  setSyncBusy(true);
  setSyncStatus("正在寄送登入連結...", "loading");

  const { error } = await state.syncClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href
    }
  });

  setSyncBusy(false);

  if (error) {
    console.error(error);
    setSyncStatus("寄送登入連結失敗，請先確認 Supabase 已開啟 Email 驗證。", "error");
    return;
  }

  setSyncStatus("登入連結已寄出。請到信箱開啟連結，再回到這個頁面。");
}

async function handleSignOut() {
  if (!state.syncClient) return;

  const { error } = await state.syncClient.auth.signOut();
  if (error) {
    console.error(error);
    setSyncStatus("登出失敗，請稍後再試。", "error");
    return;
  }

  state.authSession = null;
  setSyncStatus("已登出，現在是雲端唯讀模式。");
  render();
}

async function refreshEntriesFromCloud(showStatus) {
  if (!state.syncClient) return;

  setSyncBusy(true);
  if (showStatus) {
    setSyncStatus("正在從雲端重新整理...", "loading");
  }

  try {
    const remoteEntries = await fetchSupabaseEntries(state.syncClient);
    state.entries = remoteEntries;
    state.quote = buildHeroQuote();
    persistEntries();
    if (showStatus) {
      setSyncStatus("已更新為雲端最新資料。");
    }
    render();
  } catch (error) {
    console.error(error);
    setSyncStatus("重新整理雲端資料失敗。", "error");
  } finally {
    setSyncBusy(false);
  }
}

async function importPendingEntriesToCloud() {
  if (!state.syncClient) {
    setSyncStatus("請先連接 Supabase。", "error");
    return;
  }

  if (!ensureWritable()) return;

  if (!state.pendingImportEntries.length) {
    setSyncStatus("目前沒有待上傳的本機記錄。");
    return;
  }

  const shouldImport = window.confirm("要把目前這個瀏覽器中的記錄上傳到雲端嗎？");
  if (!shouldImport) return;

  setSyncBusy(true);
  setSyncStatus("正在把本機記錄上傳到雲端...", "loading");

  const payload = state.pendingImportEntries.map((entry) => serializeEntry(entry));
  const { error } = await state.syncClient.from(SUPABASE_TABLE).upsert(payload);

  if (error) {
    console.error(error);
    setSyncBusy(false);
    setSyncStatus("上傳到雲端失敗，請檢查資料表與權限設定。", "error");
    return;
  }

  state.pendingImportEntries = [];
  setSyncBusy(false);
  await refreshEntriesFromCloud(false);
  setSyncStatus("已把目前記錄合併到雲端。");
}

async function fetchSupabaseEntries(client) {
  const { data, error } = await client
    .from(SUPABASE_TABLE)
    .select("id, type, title, creator, cover_url, date, rating, tags, note")
    .order("date", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data.map(normalizeSupabaseEntry).sort(sortByDateDesc) : [];
}

function bindAuthListener(client) {
  if (state.authSubscription) {
    state.authSubscription.unsubscribe();
    state.authSubscription = null;
  }

  const {
    data: { subscription }
  } = client.auth.onAuthStateChange((_event, session) => {
    state.authSession = session;
    if (session?.user?.email) {
      authEmailInput.value = session.user.email;
    }
    render();
  });

  state.authSubscription = subscription;
}

function readSupabaseConfig() {
  if (window.HELEN_ARCHIVE_SUPABASE?.url && window.HELEN_ARCHIVE_SUPABASE?.anonKey) {
    return {
      url: String(window.HELEN_ARCHIVE_SUPABASE.url).trim(),
      anonKey: String(window.HELEN_ARCHIVE_SUPABASE.anonKey).trim()
    };
  }

  if (DEFAULT_SUPABASE_CONFIG.url && DEFAULT_SUPABASE_CONFIG.anonKey) {
    return {
      url: DEFAULT_SUPABASE_CONFIG.url,
      anonKey: DEFAULT_SUPABASE_CONFIG.anonKey
    };
  }

  try {
    const saved = JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || "null");
    if (saved?.url && saved?.anonKey) {
      return {
        url: String(saved.url).trim(),
        anonKey: String(saved.anonKey).trim()
      };
    }
  } catch (error) {
    console.warn("Failed to parse Supabase config.", error);
  }

  return null;
}

function saveSupabaseConfig(config) {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
}

function clearSupabaseConfig() {
  localStorage.removeItem(SUPABASE_CONFIG_KEY);
}

function serializeEntry(entry) {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    creator: entry.creator,
    cover_url: entry.coverUrl,
    date: entry.date,
    rating: entry.rating,
    tags: entry.tags,
    note: entry.note
  };
}

function normalizeSupabaseEntry(entry) {
  return normalizeEntry({
    id: entry.id,
    type: entry.type,
    title: entry.title,
    creator: entry.creator,
    coverUrl: entry.cover_url,
    date: entry.date,
    rating: entry.rating,
    tags: entry.tags,
    note: entry.note
  });
}

function canWriteEntries() {
  return state.adminMode && (state.storageMode !== "supabase" || Boolean(state.authSession));
}

function ensureWritable() {
  if (canWriteEntries()) {
    return true;
  }

  if (!state.adminMode) {
    return false;
  }

  setSyncStatus("目前已連接雲端，但還沒有登入，所以只能瀏覽；登入後才能新增、編輯與刪除。", "error");
  return false;
}

function setSyncBusy(isBusy) {
  state.syncBusy = isBusy;
  updateSyncUi();
}

function setSyncStatus(message, stateName) {
  state.syncStatusMessage = message;
  state.syncStatusState = stateName || "";
  updateSyncUi();
}

function updateSyncUi() {
  const isCloud = state.storageMode === "supabase";
  const canWrite = canWriteEntries();
  const showAdminPanel = state.adminMode;

  syncPanel.hidden = !showAdminPanel;
  entryPanel.hidden = !showAdminPanel;

  if (!showAdminPanel) {
    return;
  }

  syncBadge.textContent = isCloud ? "雲端模式" : "本機模式";
  syncModeText.textContent = isCloud
    ? canWrite
      ? "目前已連接 Supabase，且你已登入，新增、編輯與刪除都會直接同步到雲端。"
      : "目前已連接 Supabase，但還沒登入；其他瀏覽器會看到同一份資料，你需要登入後才能修改。"
    : "目前使用這個瀏覽器的本機儲存。接上 Supabase 後，就能跨電腦、跨瀏覽器看到同一份記錄。";

  syncStatus.textContent = state.syncStatusMessage;
  if (state.syncStatusState) {
    syncStatus.dataset.state = state.syncStatusState;
  } else {
    delete syncStatus.dataset.state;
  }

  connectSupabaseButton.disabled = state.syncBusy;
  refreshSupabaseButton.hidden = !isCloud;
  refreshSupabaseButton.disabled = state.syncBusy;
  importLocalButton.hidden = !isCloud || !state.pendingImportEntries.length;
  importLocalButton.disabled = state.syncBusy || !canWrite;
  disconnectSupabaseButton.hidden = !isCloud;
  disconnectSupabaseButton.disabled = state.syncBusy;
  authPanel.hidden = !isCloud;
  authEmailInput.disabled = state.syncBusy;
  supabaseUrlInput.disabled = state.syncBusy;
  supabaseKeyInput.disabled = state.syncBusy;
  sendMagicLinkButton.disabled = state.syncBusy;
  signOutButton.hidden = !state.authSession;
  signOutButton.disabled = state.syncBusy;
  submitButton.disabled = state.syncBusy || !canWrite;
  clearButton.disabled = state.syncBusy || !canWrite;
  clearButton.textContent = isCloud ? "重設雲端資料" : "重設示例資料";
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

function buildHeroQuote() {
  const quote = BOOK_QUOTES[Math.floor(Math.random() * BOOK_QUOTES.length)];

  if (!quote) {
    return {
      text: "A reader lives a thousand lives before he dies.\n人在死去之前，会先活过一千次。",
      attribution: "《A Dance with Dragons》, George R. R. Martin"
    };
  }

  return {
    text: `${quote.en}\n${quote.zh}`,
    attribution: `《${quote.title}》, ${quote.author}`
  };
}

function trimEndingPunctuation(text) {
  return String(text || "").trim().replace(/[。！？.!?]+$/, "");
}
