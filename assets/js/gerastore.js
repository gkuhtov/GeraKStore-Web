const REPO_URL = "https://raw.githubusercontent.com/gkuhtov/GeraStore/main/repo.json";
const LOCAL_APPS_URL = "data/apps.json";

const state = {
  apps: [],
  category: "Все",
  query: ""
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
    size: a.size || a.fileSize || a.ipaSize || "—",
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
    updated: a.updated || a.date || a.lastUpdated || "—",
    ios: a.minIOSVersion || a.ios || "—",
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

async function loadApps() {
  try {
    const repoResponse = await fetch(REPO_URL, {cache:"no-store"});

    if (repoResponse.ok) {
      const repo = await repoResponse.json();

      if (Array.isArray(repo.apps)) {
        state.apps = normalizeApps(repo.apps);
      } else if (repo.appsURL) {
        const appsResponse = await fetch(repo.appsURL, {cache:"no-store"});

        if (appsResponse.ok) {
          state.apps = normalizeApps(await appsResponse.json());
        }
      }
    }
  } catch(error) {
    console.warn("Не удалось загрузить удалённый каталог.", error);
  }

  if (!state.apps.length) {
    try {
      const localResponse = await fetch(LOCAL_APPS_URL, {cache:"no-store"});

      if (localResponse.ok) {
        state.apps = normalizeApps(await localResponse.json());
      }
    } catch(error) {
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

  return state.apps.filter(app => {
    const category =
      state.category === "Все" ||
      app.category === state.category;

    const text =
      `${app.name} ${app.id} ${app.description}`
        .toLowerCase();

    return category && (!query || text.includes(query));
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

          <div class="app-description">
            ${escapeHtml(app.description)}
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

  $("#appGrid").innerHTML = apps.length
    ? apps.map(appCard).join("")
    : `<div class="loading-card glass-panel">По этому запросу ничего не найдено.</div>`;

  document.querySelectorAll(".app-card").forEach(card => {
    card.addEventListener("click", () => {
      openApp(card.dataset.appId);
    });

    card.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openApp(card.dataset.appId);
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
          <span>${escapeHtml(app.updated)}</span>
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
  $("#appSearch").addEventListener("input", event => {
    state.query = event.target.value;
    renderCatalog();
  });
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

  const icon = $("#themeIcon");

  if (icon) {
    icon.textContent = theme === "light" ? "☀" : "☾";
  }

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
                      ${escapeHtml(version.date)}
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
          <strong>${escapeHtml(app.updated)}</strong>
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

  document.body.style.overflow = "hidden";

  history.replaceState(
    null,
    "",
    `${window.location.pathname}#app=${encodeURIComponent(id)}`
  );
}

function closeApp() {
  $("#appModal").classList.remove("open");
  $("#appModal").setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";

  history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`
  );
}

function setupModal() {
  $("#modalClose").addEventListener("click", closeApp);
  $("#modalBackdrop").addEventListener("click", closeApp);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
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

/* ---------------- INIT ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  cleanTrackingParameters();
  setupTheme();
  setupSearch();
  setupRepoCopy();
  setupModal();
  setupHeroVideo();
  loadApps();
});

window.addEventListener("hashchange", openHashApp);
