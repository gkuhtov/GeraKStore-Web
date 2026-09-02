const REPO_URLS = [
  "https://gkuhtov.github.io/GeraStore/repo.json",
  "https://cdn.jsdelivr.net/gh/gkuhtov/GeraStore@main/repo.json",
  "https://raw.githubusercontent.com/gkuhtov/GeraStore/main/repo.json"
];

const REPO_URL = REPO_URLS[0];
const LOCAL_APPS_URL = "data/apps.json";

const state = {
  apps: [],
  category: "Все",
  query: "",
  sort: "newest"
};

const $ = selector => document.querySelector(selector);

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[char]));

function formatSize(value) {
  const bytes = Number(value);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "—";
  }

  const mb = bytes / 1024 / 1024;

  return `${mb.toFixed(1)} MB`;
}

function formatRussianDate(value) {
  if (!value || value === "—") {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function normalizeApps(raw) {
  const list = Array.isArray(raw)
    ? raw
    : (raw?.apps || raw?.items || []);

  return list.map((a, i) => ({
    id: a.bundleIdentifier || a.bundleID || a.identifier || `app-${i}`,
    name: a.name || a.title || "Без названия",
    developer:
      a.developerName ||
      a.developer ||
      a.author ||
      "Неизвестный разработчик",
    version: a.version || a.versionName || a.appVersion || "—",
    size: formatSize(a.size || a.fileSize || a.ipaSize),
    category: a.category || a.genre || "Другое",
    description:
      a.localizedDescription ||
      a.description ||
      "Приложение из GeraKStore.",
    icon: a.iconURL || a.icon || a.iconUrl || "assets/images/gerastore-mark.svg",
    screenshots:
      Array.isArray(a.screenshots)
        ? a.screenshots
        : Array.isArray(a.screenshotURLs)
          ? a.screenshotURLs
          : [],
    download: a.downloadURL || a.downloadUrl || a.url || "#",
    updated: a.versionDate || a.updated || a.date || a.lastUpdated || "—",
    ios: a.minIOSVersion || a.ios || (a.versions?.length ? a.versions[a.versions.length-1].minIOSVersion : "") || "—",
    whatsNew:
      a.whatsNew ||
      a.whatIsNew ||
      a.changelog ||
      a.releaseNotes ||
      a.notes ||
      "",
    versions: Array.isArray(a.versions)
      ? a.versions.map(version => ({
          version: version.version || version.versionName || "—",
          date: version.date || version.versionDate || "—",
          size: version.size || version.fileSize || version.ipaSize || "",
          download:
            version.downloadURL ||
            version.downloadUrl ||
            version.url ||
            "#"
        }))
      : []
  }));
}

function mapRepoApps(repo) {
  if (Array.isArray(repo.appRepositories)) {
    const categories = Array.isArray(repo.appCategories) ? repo.appCategories : [];

    return repo.appRepositories.map((app, index) => {
      const categoryIndex = Number(app.appCateIndex);

      const category =
        app.category ||
        (Number.isInteger(categoryIndex) && categories[categoryIndex]
          ? categories[categoryIndex]
          : "Другое");

      const versions = Array.isArray(app.versions)
        ? app.versions.map(version => ({
            version: version.version || version.versionName || "—",
            date: version.date || version.versionDate || "—",
            size: version.size || version.fileSize || version.ipaSize || "",
            minIOSVersion: version.minIOSVersion || version.minimumIOSVersion || version.ios || "",
            download: version.downloadURL || version.downloadUrl || version.url || "#"
          }))
        : [];

      const latest = versions.length ? versions[versions.length - 1] : {};

      const rawSize =
        app.appSize ||
        app.size ||
        app.fileSize ||
        latest.size ||
        0;

      return {
        id: app.bundleIdentifier || app.bundleID || app.identifier || "app-" + index,
        name: app.appName || app.name || app.title || "Без названия",
        developer: app.developerName || app.developer || app.author || "Неизвестный разработчик",
        version: app.appVersion || app.version || latest.version || "—",
        size: formatSize(rawSize),
        category: category,
        description: app.appDescription || app.localizedDescription || app.description || "Приложение из GeraKStore.",
        icon: app.appImage || app.iconURL || app.icon || app.iconUrl || "assets/images/gerastore-mark.svg",
        screenshots: Array.isArray(app.screenshots) ? app.screenshots : Array.isArray(app.screenshotURLs) ? app.screenshotURLs : [],
        download: app.appPackage || app.downloadURL || app.downloadUrl || app.url || latest.download || "#",
        updated: app.appUpdateTime || app.versionDate || app.updated || app.date || "—",
        ios: app.minIOSVersion || app.minimumIOSVersion || app.ios || latest.minIOSVersion || "—",
        whatsNew: app.whatsNew || app.whatIsNew || app.changelog || app.releaseNotes || app.notes || "",
        versions: versions
      };
    });
  }

  if (Array.isArray(repo.apps)) {
    return normalizeApps(repo.apps);
  }

  return [];
}

async function fetchRepoJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now(), {
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(url + " → " + response.status);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadApps() {
  state.apps = [];

  for (const url of REPO_URLS) {
    try {
      const repo = await fetchRepoJson(url);
      let apps = mapRepoApps(repo);

      if (!apps.length && repo.appsURL) {
        const appsResponse = await fetch(repo.appsURL, {cache: "no-store"});
        if (appsResponse.ok) {
          apps = normalizeApps(await appsResponse.json());
        }
      }

      if (apps.length) {
        state.apps = apps;
        console.info("GeraKStore catalog loaded from", url);
        break;
      }
    } catch (error) {
      console.warn("Catalog source failed:", url, error);
    }
  }

  if (!state.apps.length) {
    try {
      const localResponse = await fetch(LOCAL_APPS_URL, {cache: "no-store"});
      if (localResponse.ok) {
        state.apps = normalizeApps(await localResponse.json());
      }
    } catch (error) {
      console.warn("Не удалось загрузить локальный каталог.", error);
    }
  }

  renderAll();
}

function categories() {
  return [
    "Все",
    ...new Set(
      state.apps
        .map(app => app.category)
        .filter(Boolean)
    )
  ];
}

function renderFilters() {
  $("#categoryFilters").innerHTML = categories()
    .map(category => `
      <button
        class="filter ${category === state.category ? "active" : ""}"
        data-category="${escapeHtml(category)}">
        ${escapeHtml(category)}
      </button>
    `)
    .join("");

  document.querySelectorAll(".filter").forEach(button => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      renderAll();
    });
  });
}

function filteredApps() {
  const query = state.query.trim().toLowerCase();

  const apps = state.apps.filter(app => {
    const category =
      state.category === "Все" ||
      app.category === state.category;

    const text =
      `${app.name} ${app.id} ${app.description} ${app.developer}`
        .toLowerCase();

    return category && (!query || text.includes(query));
  });

  return apps.sort((a, b) => {
    switch (state.sort) {
      case "name":
        return String(a.name).localeCompare(
          String(b.name),
          "ru",
          { sensitivity: "base" }
        );

      case "size": {
        const sizeA = parseFloat(String(a.size).replace(",", ".")) || 0;
        const sizeB = parseFloat(String(b.size).replace(",", ".")) || 0;
        return sizeB - sizeA;
      }

      case "version":
        return String(b.version).localeCompare(
          String(a.version),
          undefined,
          { numeric: true, sensitivity: "base" }
        );

      case "newest":
      default:
        return String(b.updated).localeCompare(String(a.updated));
    }
  });
}

function appCard(app) {
  return `
    <article
      class="app-card glass-panel"
      data-app-id="${escapeHtml(app.id)}"
      tabindex="0"
      role="button"
      aria-label="Открыть ${escapeHtml(app.name)}">

      <div class="app-card-main">

        <img
          class="app-icon"
          src="${escapeHtml(app.icon)}"
          alt=""
          loading="lazy"
          onerror="this.src='assets/images/gerastore-mark.svg'">

        <div class="app-card-info">
          <div class="app-title">
            ${escapeHtml(app.name)}
          </div>


          <div class="app-meta">
            <span>v${escapeHtml(app.version)}</span>
            <span>·</span>
            <span>${escapeHtml(app.size)}</span>
          </div>
        </div>

      </div>

      <div class="app-card-footer">
        <span class="app-category">
          ${escapeHtml(app.category)}
        </span>

        <span class="app-arrow">
          Подробнее
          <b>›</b>
        </span>
      </div>

    </article>
  `;
}

function renderCatalog() {
  const apps = filteredApps();
  const grid = $("#appGrid");

  updateCatalogStatus(apps.length);

  if (!apps.length) {
    const query = state.query.trim();

    grid.innerHTML = `
      <div class="catalog-empty glass-panel">
        <div class="catalog-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5"></circle>
            <path d="m16 16 5 5"></path>
            <path d="M8.5 11h5"></path>
          </svg>
        </div>

        <div class="catalog-empty-content">
          <strong>
            ${query ? "Ничего не найдено" : "В этой категории пока пусто"}
          </strong>

          <p>
            ${
              query
                ? `По запросу «${escapeHtml(query)}» ничего не найдено. Попробуй изменить запрос или выбрать другую категорию.`
                : "Попробуй выбрать другую категорию."
            }
          </p>

          ${
            query
              ? `
                <button class="glass-button catalog-empty-reset" type="button">
                  Очистить поиск
                </button>
              `
              : ""
          }
        </div>
      </div>
    `;

    const reset = grid.querySelector(".catalog-empty-reset");

    if (reset) {
      reset.addEventListener("click", () => {
        state.query = "";
        $("#appSearch").value = "";
        renderCatalog();
        $("#appSearch").focus();
      });
    }

    return;
  }

  grid.innerHTML = apps
    .map((app, index) => `
      <div
        class="catalog-card-enter"
        style="--catalog-index:${Math.min(index, 8)}">
        ${appCard(app)}
      </div>
    `)
    .join("");

  grid.querySelectorAll(".app-card").forEach(card => {
    const open = () => {
      const id = card.dataset.appId;

      if (!id) {
        console.warn("У карточки отсутствует data-app-id");
        return;
      }

      openApp(id);
    };

    card.addEventListener("click", open);

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    });
  });
}

function renderUpdates() {
  const apps = [...state.apps]
    .sort((a, b) =>
      String(b.updated).localeCompare(String(a.updated))
    )
    .slice(0, 6);

  $("#updatesGrid").innerHTML = apps.length
    ? apps.map(app => `
      <article class="update-card glass-panel">
        <div>
          <strong>${escapeHtml(app.name)}</strong>
          <span>${escapeHtml(formatRussianDate(app.updated))}</span>
        </div>

        <span class="update-version">
          v${escapeHtml(app.version)}
        </span>
      </article>
    `).join("")
    : `<div class="loading-card glass-panel">
        Данные об обновлениях появятся после подключения каталога.
      </div>`;
}

function renderStats() {
  $("[data-stat='apps']").textContent = state.apps.length;

  $("[data-stat='categories']").textContent =
    categories().filter(value => value !== "Все").length;

  loadRepoUpdatedDate();
}

async function loadRepoUpdatedDate() {
  const element = $("[data-stat='updated']");

  if (!element) return;

  try {
    const response = await fetch(
      "https://api.github.com/repos/gkuhtov/GeraStore",
      {cache:"no-store"}
    );

    if (!response.ok) throw new Error("GitHub API error");

    const repo = await response.json();

    if (!repo.pushed_at) throw new Error("Дата обновления не найдена");

    const date = new Date(repo.pushed_at);

    element.textContent = date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch(error) {
    console.warn("Не удалось получить дату обновления репозитория.", error);
    element.textContent = "—";
  }
}

function renderAll() {
  renderFilters();
  renderCatalog();
  renderUpdates();
  renderStats();
}

function setupSearch() {
  const input = $("#appSearch");
  const clear = $("#searchClear");
  const sort = $("#appSort");

  input.addEventListener("input", event => {
    state.query = event.target.value;
    renderCatalog();
  });

  if (clear) {
    clear.addEventListener("click", () => {
      state.query = "";
      input.value = "";
      renderCatalog();
      input.focus();
    });
  }

  if (sort) {
    sort.value = state.sort;

    sort.addEventListener("change", event => {
      state.sort = event.target.value;
      renderCatalog();
    });
  }
}

function updateCatalogStatus(count) {
  const countElement = $("#catalogCount");
  const contextElement = $("#catalogContext");

  if (countElement) {
    const lastTwo = count % 100;
    const lastOne = count % 10;

    let word = "приложений";

    if (lastTwo >= 11 && lastTwo <= 19) {
      word = "приложений";
    } else if (lastOne === 1) {
      word = "приложение";
    } else if (lastOne >= 2 && lastOne <= 4) {
      word = "приложения";
    }

    countElement.textContent = `${count} ${word}`;
  }

  if (contextElement) {
    contextElement.textContent =
      state.category === "Все"
        ? "Все приложения"
        : state.category;
  }
}

/* ---------------- THEME ---------------- */

function getInitialTheme() {
  const saved = localStorage.getItem("gerastore-theme");

  if (saved === "light" || saved === "dark") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  const sun = $("#themeIconSun");
  const moon = $("#themeIconMoon");

  if (sun) sun.setAttribute("aria-hidden", theme !== "light" ? "true" : "false");
  if (moon) moon.setAttribute("aria-hidden", theme === "light" ? "true" : "false");

  localStorage.setItem("gerastore-theme", theme);
}

function setupTheme() {
  applyTheme(getInitialTheme());

  $("#themeToggle").addEventListener("click", () => {
    const current =
      document.documentElement.dataset.theme || "dark";

    applyTheme(current === "dark" ? "light" : "dark");
  });
}

/* ---------------- BACK TO TOP ---------------- */

function setupBackToTop() {
  const button = $("#backToTop");

  if (!button) return;

  const update = () => {
    button.classList.toggle("show", window.scrollY > 500);
  };

  window.addEventListener("scroll", update, {passive:true});

  button.addEventListener("click", () => {
    window.scrollTo({
      top:0,
      behavior:"smooth"
    });
  });

  update();
}


/* ---------------- APP CARD ANIMATION ---------------- */

function setupAppCardAnimation() {
  // Открытие карточки выполняется только через renderCatalog().
  // Здесь больше нет отдельного click handler, чтобы openApp() не вызывался дважды.
}

/* ---------------- CARD CURSOR LIGHT ---------------- */

function setupCardCursorLight() {
  document.addEventListener("pointermove", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const card = target.closest(".app-card");

    if (!card) return;

    const rect = card.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    card.style.setProperty("--mouse-x", `${x}%`);
    card.style.setProperty("--mouse-y", `${y}%`);
  }, {passive:true});

  document.addEventListener("pointerleave", event => {
    const target = event.target;

    if (!(target instanceof Element)) return;

    const card = target.closest(".app-card");

    if (!card) return;

    card.style.setProperty("--mouse-x", "50%");
    card.style.setProperty("--mouse-y", "50%");
  }, true);
}


/* ---------------- REPO COPY ---------------- */


function setupRepoCopy() {
  $("#copyRepo").addEventListener("click", async () => {
    const repo =
      "https://raw.githubusercontent.com/gkuhtov/GeraStore/main/repo.json";

    try {
      await navigator.clipboard.writeText(repo);
      $("#copyStatus").textContent =
        "Ссылка на репозиторий скопирована.";
    } catch(error) {
      $("#copyStatus").textContent =
        "Скопируй ссылку вручную: " + repo;
    }
  });
}

/* ---------------- APP DETAIL ---------------- */

let lockedPageScrollY = 0;
let pageScrollLocked = false;

function pageScrollEventIsInsideDetail(event) {
  const detail = document.querySelector("#appModal .app-detail");

  return !!(detail && detail.contains(event.target));
}

function blockBackgroundScroll(event) {
  if (!pageScrollLocked) return;

  if (pageScrollEventIsInsideDetail(event)) return;

  event.preventDefault();
  event.stopImmediatePropagation();
}

function blockBackgroundKeys(event) {
  if (!pageScrollLocked) return;

  const keys = [
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    " ",
    "Spacebar"
  ];

  if (!keys.includes(event.key)) return;

  const detail = document.querySelector("#appModal .app-detail");

  if (detail && document.activeElement && detail.contains(document.activeElement)) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
}

function lockPageScroll() {
  lockedPageScrollY = window.scrollY;
  pageScrollLocked = true;

  // Не изменяем html/body.
  // Не меняем overflow, position, top и scrollY.

  window.addEventListener("wheel", blockBackgroundScroll, {
    passive: false,
    capture: true
  });

  window.addEventListener("touchmove", blockBackgroundScroll, {
    passive: false,
    capture: true
  });

  window.addEventListener("keydown", blockBackgroundKeys, {
    capture: true
  });
}

function unlockPageScroll() {
  pageScrollLocked = false;

  window.removeEventListener("wheel", blockBackgroundScroll, true);
  window.removeEventListener("touchmove", blockBackgroundScroll, true);
  window.removeEventListener("keydown", blockBackgroundKeys, true);
}
function openApp(id) {
  const app = state.apps.find(item => item.id === id);

  if (!app) return;

  const content = $("#appDetailContent");


  content.innerHTML = `
    <div class="detail-hero">

      <img
        class="detail-icon"
        src="${escapeHtml(app.icon)}"
        alt=""
        onerror="this.src='assets/images/gerastore-mark.svg'">

      <div class="detail-main">

        <div class="detail-category">
          ${escapeHtml(app.category)}
        </div>

        <h2 class="detail-title">
          ${escapeHtml(app.name)}
        </h2>

        <p class="detail-developer">
          ${escapeHtml(app.developer)}
        </p>

        <p class="detail-meta">
          Версия ${escapeHtml(app.version)}
          · ${escapeHtml(app.size)}
        </p>

        <div class="detail-actions">
          ${
            app.download !== "#"
              ? `
                <a
                  class="liquid-button liquid-button-primary detail-download"
                  href="${escapeHtml(app.download)}"
                  target="_blank"
                  rel="noopener">
                  Скачать
                </a>
              `
              : `
                <span class="glass-button detail-download disabled">
                  Скоро
                </span>
              `
          }
        </div>

      </div>

    </div>

    <div class="detail-divider"></div>

    <section class="detail-section">
      <div class="section-kicker">Описание</div>

      <p class="detail-description">
        ${escapeHtml(app.description)}
      </p>
    </section>

    ${
      app.screenshots.length
        ? `
          <section class="detail-section detail-screenshots-section">
            <div class="section-kicker">Скриншоты</div>

            <div class="detail-screenshots">
              ${app.screenshots.map((image, index) => `
                <div class="detail-screenshot">
                  <img
                    src="${escapeHtml(image)}"
                    alt="${escapeHtml(app.name)}. Скриншот ${index + 1}"
                    loading="lazy"
                    onerror="this.parentElement.remove()">
                </div>
              `).join("")}
            </div>
          </section>
        `
        : ""
    }

    ${
      app.whatsNew
        ? `
          <section class="detail-section whats-new-section">
            <div class="section-kicker">Что нового</div>

            <div class="whats-new">
              <div class="whats-new-version">
                Версия ${escapeHtml(app.version)}
              </div>

              <p>
                ${escapeHtml(app.whatsNew)}
              </p>
            </div>
          </section>
        `
        : ""
    }

    ${
      app.versions.length
        ? `
          <section class="detail-section">
            <div class="section-kicker">Версии</div>

            <div class="detail-versions">
              ${app.versions.map((version, index) => `
                <div class="detail-version-row">

                  <div class="detail-version-info">
                    <div class="detail-version-name">
                      ${escapeHtml(version.version)}
                      ${index === 0 ? '<span class="detail-current-version">Текущая</span>' : ""}
                    </div>

                    <div class="detail-version-date">
                      ${escapeHtml(formatRussianDate(version.date))}
                      ${version.size ? ` · ${escapeHtml(version.size)}` : ""}
                    </div>
                  </div>

                  ${
                    version.download !== "#"
                      ? `
                        <a
                          class="liquid-button liquid-button-primary detail-version-download"
                          href="${escapeHtml(version.download)}"
                          target="_blank"
                          rel="noopener">
                          Скачать
                        </a>
                      `
                      : `
                        <span class="glass-button detail-version-download disabled">
                          Недоступно
                        </span>
                      `
                  }

                </div>
              `).join("")}
            </div>
          </section>
        `
        : ""
    }

    <section class="detail-section">

      <div class="section-kicker">Информация</div>

      <div class="detail-info">

        <div class="detail-info-item">
          <span>Версия</span>
          <strong>${escapeHtml(app.version)}</strong>
        </div>

        <div class="detail-info-item">
          <span>Размер</span>
          <strong>${escapeHtml(app.size)}</strong>
        </div>

        <div class="detail-info-item">
          <span>Минимальная iOS</span>
          <strong>${escapeHtml(app.ios)}</strong>
        </div>

        <div class="detail-info-item">
          <span>Категория</span>
          <strong>${escapeHtml(app.category)}</strong>
        </div>

        <div class="detail-info-item detail-info-wide">
          <span>Bundle ID</span>
          <strong>${escapeHtml(app.id)}</strong>
        </div>

        <div class="detail-info-item">
          <span>Обновлено</span>
          <strong>${escapeHtml(formatRussianDate(app.updated))}</strong>
        </div>

      </div>

    </section>

    <section class="detail-section detail-note">
      <span>GeraKStore</span>
      <p>Приложение доступно для установки через репозиторий GeraKStore.</p>
    </section>
  `;

  $("#appModal").classList.add("open");
  $("#appModal").setAttribute("aria-hidden", "false");

  lockPageScroll();

  history.replaceState(
    null,
    "",
    `${window.location.pathname}#app=${encodeURIComponent(id)}`
  );
}

function setupScreenshotViewer() {
  const screenshots = document.querySelectorAll(".detail-screenshot img");

  screenshots.forEach(image => {
    if (image.dataset.viewerReady) return;

    image.dataset.viewerReady = "true";
    image.addEventListener("click", () => {
      openScreenshotViewer(image.src, image.alt);
    });
  });
}

function openScreenshotViewer(src, alt) {
  let viewer = document.querySelector("#screenshotViewer");

  if (!viewer) {
    viewer = document.createElement("div");
    viewer.id = "screenshotViewer";
    viewer.className = "screenshot-viewer";
    viewer.innerHTML = `
      <div class="screenshot-viewer-backdrop"></div>
      <button
        class="screenshot-viewer-close glass-chip"
        type="button"
        aria-label="Закрыть скриншот">
        ×
      </button>
      <img class="screenshot-viewer-image" alt="">
    `;

    document.body.appendChild(viewer);

    viewer.querySelector(".screenshot-viewer-backdrop")
      .addEventListener("click", closeScreenshotViewer);

    viewer.querySelector(".screenshot-viewer-close")
      .addEventListener("click", closeScreenshotViewer);

    viewer.addEventListener("click", event => {
      if (event.target === viewer.querySelector(".screenshot-viewer-image")) {
        closeScreenshotViewer();
      }
    });
  }

  const image = viewer.querySelector(".screenshot-viewer-image");
  image.src = src;
  image.alt = alt || "";

  viewer.classList.add("open");
  viewer.setAttribute("aria-hidden", "false");
}

function closeScreenshotViewer() {
  const viewer = document.querySelector("#screenshotViewer");

  if (!viewer) return;

  viewer.classList.remove("open");
  viewer.setAttribute("aria-hidden", "true");
}

function closeApp() {
  const detail = document.querySelector(".app-detail");

  if (detail) {
    detail.scrollTop = 0;
  }

  $("#appModal").classList.remove("open");
  $("#appModal").setAttribute("aria-hidden", "true");

  unlockPageScroll();

  history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`
  );
}

function setupModal() {
  const close = $("#modalClose");
  const backdrop = $("#modalBackdrop");

  close?.addEventListener("click", closeApp);
  backdrop?.addEventListener("click", closeApp);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      const viewer = document.querySelector("#screenshotViewer");

      if (viewer?.classList.contains("open")) {
        closeScreenshotViewer();
        return;
      }

      closeApp();
    }
  });
}

function openHashApp() {
  const hash = window.location.hash;

  if (!hash.startsWith("#app=")) return;

  const id = decodeURIComponent(
    hash.substring(5)
  );

  if (state.apps.length) {
    openApp(id);
  }
}

/* ---------------- HERO VIDEO ---------------- */

function setupHeroVideo() {
  const video = $("#heroVideo");
  const status = $("#mediaStatus");

  if (!video) return;

  let timeout = setTimeout(() => {
    if (!video.classList.contains("is-ready")) {
      status.textContent = "Оптимальный режим";
    }
  }, 4500);

  video.addEventListener("canplay", () => {
    clearTimeout(timeout);

    video.classList.add("is-ready");
    status.textContent = "Live visual";
  }, {once:true});

  video.addEventListener("error", () => {
    clearTimeout(timeout);

    status.textContent = "Статичный режим";
  }, {once:true});

  if (navigator.connection?.saveData) {
    video.removeAttribute("src");
    video.style.display = "none";
    status.textContent = "Экономия трафика";
  }
}

/* ---------------- URL CLEANUP ---------------- */

function cleanTrackingParameters() {
  if (!window.location.search) return;

  const params = new URLSearchParams(window.location.search);

  const trackingPrefixes = [
    "utm_",
    "fbclid",
    "gclid",
    "yclid",
    "mc_cid",
    "mc_eid"
  ];

  let hasTracking = false;

  for (const key of params.keys()) {
    if (
      trackingPrefixes.some(prefix =>
        key === prefix ||
        key.startsWith(prefix)
      )
    ) {
      hasTracking = true;
    }
  }

  if (!hasTracking) return;

  window.history.replaceState(
    {},
    document.title,
    window.location.pathname + window.location.hash
  );
}


/* ---------------- SCROLL RESTORE ---------------- */

/* ---------------- INIT ---------------- */

/* ---------------- INIT ---------------- */

/* ---------------- INIT ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  cleanTrackingParameters();
  setupTheme();
  setupBackToTop();
  setupAppCardAnimation();
  setupCardCursorLight();
  setupSearch();
  setupRepoCopy();
  setupModal();
  setupHeroVideo();
  loadApps();
});

window.addEventListener("hashchange", openHashApp);

/* ---------------- SHOWCASE SECTIONS ---------------- */

(function setupShowcase() {
  function getAppDate(app) {
    return app.updatedAt || app.updated || app.releaseDate || app.date || "";
  }

  function dateValue(app) {
    const value = getAppDate(app);
    const time = Date.parse(value);
    return Number.isNaN(time) ? 0 : time;
  }

  function renderShowcase() {
    const newGrid = document.getElementById("newAppsGrid");

    if (!newGrid) return;
    if (!Array.isArray(state.apps) || !state.apps.length) return;

    const apps = [...state.apps]
      .sort((a, b) => dateValue(b) - dateValue(a))
      .slice(0, 4);

    newGrid.innerHTML = apps.map(appCard).join("");

    newGrid.querySelectorAll(".app-card").forEach(card => {
      const appId = card.dataset.appId;
      if (!appId) return;

      const open = () => {
        if (typeof openApp === "function") {
          openApp(appId);
        }
      };

      card.addEventListener("click", open);

      card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
  }

  function setupShowcaseNavigation() {
    document.querySelectorAll("[data-show-catalog]").forEach(button => {
      button.addEventListener("click", () => {
        const catalog = document.getElementById("catalog");

        if (catalog) {
          catalog.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupShowcaseNavigation();

    const originalRenderAll = window.renderAll;

    if (typeof originalRenderAll === "function") {
      window.renderAll = function () {
        originalRenderAll();
        renderShowcase();
      };
    }

    setTimeout(renderShowcase, 300);
    setTimeout(renderShowcase, 1200);
  });
})();

/* ---------------- SHOWCASE SCROLL REVEAL ---------------- */

(function setupShowcaseReveal() {
  document.addEventListener("DOMContentLoaded", () => {
    const section = document.querySelector(".showcase-section");

    if (!section) return;

    if (!("IntersectionObserver" in window)) {
      section.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            section.classList.add("is-visible");
            observer.unobserve(section);
          }
        });
      },
      {
        threshold: 0.12
      }
    );

    observer.observe(section);
  });
})();



/* ============================================================
   GLOBAL SECTION SCROLL REVEAL
   ============================================================ */

(function setupGlobalSectionReveal() {
  const selector = [
    ".intro",
    ".stats",
    ".features",
    ".catalog",
    ".install",
    ".updates",
    ".cta"
  ].join(",");

  function init() {
    const sections = document.querySelectorAll(selector);

    if (!sections.length) return;

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      sections.forEach(section => {
        section.classList.add("is-visible");
      });

      return;
    }

    if (!("IntersectionObserver" in window)) {
      sections.forEach(section => {
        section.classList.add("is-visible");
      });

      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -140px 0px"
      }
    );

    sections.forEach(section => {
      observer.observe(section);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
