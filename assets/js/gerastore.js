/*
  GeraStore Web
  URL cleanup + repository catalog + adaptive hero video
*/

/* Убираем ?utm_source=... и другие параметры из адреса */
if (window.location.search) {
  window.history.replaceState(
    {},
    document.title,
    window.location.pathname + window.location.hash
  );
}

const REPO_URL = "https://raw.githubusercontent.com/gkuhtov/GeraStore/main/repo.json";
const LOCAL_APPS_URL = "data/apps.json";

const state = {
  apps: [],
  category: "Все",
  query: ""
};

const $ = (selector) => document.querySelector(selector);

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[character]));

/* ---------------------------------------------------------
   APP DATA
--------------------------------------------------------- */

function normalizeApps(raw) {
  const list = Array.isArray(raw)
    ? raw
    : (raw?.apps || raw?.items || []);

  return list.map((app, index) => ({
    id:
      app.bundleIdentifier ||
      app.bundleID ||
      app.identifier ||
      `app-${index}`,

    name:
      app.name ||
      app.title ||
      "Без названия",

    version:
      app.version ||
      app.versionName ||
      app.appVersion ||
      "—",

    size:
      app.size ||
      app.fileSize ||
      app.ipaSize ||
      "—",

    category:
      app.category ||
      app.genre ||
      "Другое",

    description:
      app.description ||
      "Приложение из GeraStore.",

    icon:
      app.iconURL ||
      app.icon ||
      app.iconUrl ||
      "assets/images/gerastore-mark.svg",

    download:
      app.downloadURL ||
      app.downloadUrl ||
      app.url ||
      "#",

    updated:
      app.updated ||
      app.date ||
      app.lastUpdated ||
      "—",

    ios:
      app.minIOSVersion ||
      app.ios ||
      "—"
  }));
}

async function loadApps() {
  try {
    const repositoryResponse = await fetch(
      REPO_URL,
      { cache: "no-store" }
    );

    if (repositoryResponse.ok) {
      const repository = await repositoryResponse.json();

      if (Array.isArray(repository.apps)) {
        state.apps = normalizeApps(repository.apps);
      } else if (repository.appsURL) {
        const appsResponse = await fetch(
          repository.appsURL,
          { cache: "no-store" }
        );

        if (appsResponse.ok) {
          state.apps = normalizeApps(
            await appsResponse.json()
          );
        }
      }
    }
  } catch (error) {
    console.warn(
      "GeraStore remote repository unavailable:",
      error
    );
  }

  /* Локальный fallback */
  if (!state.apps.length) {
    try {
      const localResponse = await fetch(
        LOCAL_APPS_URL,
        { cache: "no-store" }
      );

      if (localResponse.ok) {
        state.apps = normalizeApps(
          await localResponse.json()
        );
      }
    } catch (error) {
      console.warn(
        "Local apps database unavailable:",
        error
      );
    }
  }

  renderAll();
}

/* ---------------------------------------------------------
   CATEGORIES
--------------------------------------------------------- */

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
  const container = $("#categoryFilters");

  if (!container) return;

  container.innerHTML = categories()
    .map(category => `
      <button
        class="filter ${
          category === state.category ? "active" : ""
        }"
        data-category="${escapeHtml(category)}"
      >
        ${escapeHtml(category)}
      </button>
    `)
    .join("");

  container
    .querySelectorAll(".filter")
    .forEach(button => {
      button.addEventListener("click", () => {
        state.category = button.dataset.category;
        renderAll();
      });
    });
}

/* ---------------------------------------------------------
   SEARCH
--------------------------------------------------------- */

function filteredApps() {
  const query = state.query
    .trim()
    .toLowerCase();

  return state.apps.filter(app => {
    const categoryMatches =
      state.category === "Все" ||
      app.category === state.category;

    const searchableText =
      `${app.name} ${app.id} ${app.description}`
        .toLowerCase();

    return (
      categoryMatches &&
      (!query || searchableText.includes(query))
    );
  });
}

/* ---------------------------------------------------------
   APP CARDS
--------------------------------------------------------- */

function appCard(app) {
  return `
    <article class="app-card glass-panel">

      <div>

        <div class="app-top">

          <img
            class="app-icon"
            src="${escapeHtml(app.icon)}"
            alt=""
            loading="lazy"
            onerror="this.src='assets/images/gerastore-mark.svg'"
          >

          <div>

            <div class="app-title">
              ${escapeHtml(app.name)}
            </div>

            <div class="app-meta">
              v${escapeHtml(app.version)}
              ·
              ${escapeHtml(app.ios)}
            </div>

          </div>

        </div>

        <p class="app-desc">
          ${escapeHtml(app.description)}
        </p>

      </div>

      <div class="app-bottom">

        <div class="app-tags">

          <span class="tag">
            ${escapeHtml(app.category)}
          </span>

          <span class="tag">
            ${escapeHtml(app.size)}
          </span>

        </div>

        ${
          app.download !== "#"
            ? `
              <a
                class="app-link"
                href="${escapeHtml(app.download)}"
                target="_blank"
                rel="noopener"
              >
                Открыть
              </a>
            `
            : `
              <span class="tag">
                Ссылка появится
              </span>
            `
        }

      </div>

    </article>
  `;
}

function renderCatalog() {
  const container = $("#appGrid");

  if (!container) return;

  const apps = filteredApps();

  container.innerHTML = apps.length
    ? apps.map(appCard).join("")
    : `
      <div class="loading-card glass-panel">
        По этому запросу ничего не найдено.
      </div>
    `;
}

/* ---------------------------------------------------------
   UPDATES
--------------------------------------------------------- */

function renderUpdates() {
  const container = $("#updatesGrid");

  if (!container) return;

  const apps = [...state.apps]
    .sort((a, b) =>
      String(b.updated).localeCompare(
        String(a.updated)
      )
    )
    .slice(0, 6);

  container.innerHTML = apps.length
    ? apps.map(app => `
      <article class="update-card glass-panel">

        <div>

          <strong>
            ${escapeHtml(app.name)}
          </strong>

          <span>
            ${escapeHtml(app.updated)}
          </span>

        </div>

        <span class="update-version">
          v${escapeHtml(app.version)}
        </span>

      </article>
    `).join("")
    : `
      <div class="loading-card glass-panel">
        Данные об обновлениях появятся после
        подключения каталога.
      </div>
    `;
}

/* ---------------------------------------------------------
   STATISTICS
--------------------------------------------------------- */

function renderStats() {
  const apps = $("[data-stat='apps']");
  const categoriesElement =
    $("[data-stat='categories']");
  const versions =
    $("[data-stat='versions']");

  if (apps) {
    apps.textContent = state.apps.length;
  }

  if (categoriesElement) {
    categoriesElement.textContent =
      categories()
        .filter(category => category !== "Все")
        .length;
  }

  if (versions) {
    versions.textContent =
      new Set(
        state.apps.map(app => app.version)
      ).size;
  }
}

function renderAll() {
  renderFilters();
  renderCatalog();
  renderUpdates();
  renderStats();
}

/* ---------------------------------------------------------
   SEARCH SETUP
--------------------------------------------------------- */

function setupSearch() {
  const input = $("#appSearch");

  if (!input) return;

  input.addEventListener("input", event => {
    state.query = event.target.value;
    renderCatalog();
  });
}

/* ---------------------------------------------------------
   REPOSITORY COPY
--------------------------------------------------------- */

function setupRepoCopy() {
  const button = $("#copyRepo");
  const status = $("#copyStatus");

  if (!button) return;

  button.addEventListener("click", async () => {

    const repoUrl =
      "https://raw.githubusercontent.com/gkuhtov/GeraStore/main/repo.json";

    try {

      await navigator.clipboard.writeText(
        repoUrl
      );

      if (status) {
        status.textContent =
          "Ссылка на репозиторий скопирована.";
      }

    } catch (error) {

      if (status) {
        status.textContent =
          "Скопируй ссылку вручную: " +
          repoUrl;
      }

    }
  });
}

/* ---------------------------------------------------------
   HERO VIDEO
--------------------------------------------------------- */

function setupHeroVideo() {
  const video = $("#heroVideo");
  const status = $("#mediaStatus");
  const poster =
    document.querySelector(".hero-poster");

  if (!video) return;

  const setStatus = text => {
    if (status) {
      status.textContent = text;
    }
  };

  const usePoster = text => {

    video.classList.remove("is-ready");

    if (poster) {
      poster.style.opacity = "1";
    }

    setStatus(text);
  };

  const useVideo = () => {

    if (poster) {
      poster.style.opacity = "0";
    }

    video.classList.add("is-ready");

    setStatus("Live visual");
  };

  /* Экономия трафика */
  if (
    navigator.connection &&
    navigator.connection.saveData
  ) {

    video.pause();
    video.removeAttribute("src");
    video.load();

    usePoster("Экономия трафика");

    return;
  }

  /* Reduced Data */
  if (
    window.matchMedia &&
    window.matchMedia(
      "(prefers-reduced-data: reduce)"
    ).matches
  ) {

    video.pause();
    video.removeAttribute("src");
    video.load();

    usePoster("Статичный режим");

    return;
  }

  /* Очень медленное соединение */
  const connection =
    navigator.connection;

  if (
    connection &&
    (
      connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g"
    )
  ) {

    video.pause();
    video.removeAttribute("src");
    video.load();

    usePoster("Статичный режим");

    return;
  }

  /* Используем оптимизированное видео */
  video.src =
    "assets/video/background-web.mp4";

  video.load();

  let videoReady = false;

  const timeout = setTimeout(() => {

    if (!videoReady) {
      usePoster("Статичный режим");
    }

  }, 8000);

  video.addEventListener(
    "canplay",
    () => {

      videoReady = true;

      clearTimeout(timeout);

      useVideo();

      video.play().catch(() => {
        usePoster("Статичный режим");
      });

    },
    { once: true }
  );

  video.addEventListener(
    "error",
    () => {

      clearTimeout(timeout);

      usePoster("Статичный режим");

    },
    { once: true }
  );

  video.addEventListener(
    "stalled",
    () => {

      if (!videoReady) {
        usePoster("Статичный режим");
      }

    }
  );

  video.addEventListener(
    "abort",
    () => {

      if (!videoReady) {
        usePoster("Статичный режим");
      }

    }
  );
}

/* ---------------------------------------------------------
   START
--------------------------------------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    setupSearch();
    setupRepoCopy();
    setupHeroVideo();
    loadApps();

  }
);
