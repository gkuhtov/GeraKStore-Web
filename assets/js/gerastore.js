const REPO_URL = "https://raw.githubusercontent.com/gkuhtov/GeraStore/main/repo.json";
const LOCAL_APPS_URL = "data/apps.json";

const state = {
  apps: [],
  category: "Все",
  query: ""
};

const $ = (s) => document.querySelector(s);

const escapeHtml = (v = "") =>
  String(v).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));

function normalizeApps(raw) {
  const list = Array.isArray(raw)
    ? raw
    : (raw?.apps || raw?.items || []);

  return list.map((a, i) => ({
    id: a.bundleIdentifier || a.bundleID || a.identifier || `app-${i}`,
    name: a.name || a.title || "Без названия",
    version: a.version || a.versionName || a.appVersion || "—",
    size: a.size || a.fileSize || a.ipaSize || "—",
    category: a.category || a.genre || "Другое",
    description: a.description || "Приложение из GeraStore.",
    icon: a.iconURL || a.icon || a.iconUrl || "assets/images/gerastore-mark.svg",
    download: a.downloadURL || a.downloadUrl || a.url || "#",
    updated: a.updated || a.date || a.lastUpdated || "—",
    ios: a.minIOSVersion || a.ios || "—"
  }));
}

async function loadApps() {
  try {
    const repo = await fetch(REPO_URL, { cache: "no-store" });

    if (repo.ok) {
      const data = await repo.json();

      if (Array.isArray(data.apps)) {
        state.apps = normalizeApps(data.apps);
      } else if (data.appsURL) {
        const r = await fetch(data.appsURL, { cache: "no-store" });

        if (r.ok) {
          state.apps = normalizeApps(await r.json());
        }
      }
    }
  } catch (e) {
    console.warn("GeraStore remote repository unavailable:", e);
  }

  if (!state.apps.length) {
    try {
      const local = await fetch(LOCAL_APPS_URL, { cache: "no-store" });

      if (local.ok) {
        state.apps = normalizeApps(await local.json());
      }
    } catch (e) {
      console.warn("Local apps database unavailable:", e);
    }
  }

  renderAll();
}

function categories() {
  return [
    "Все",
    ...new Set(
      state.apps
        .map(a => a.category)
        .filter(Boolean)
    )
  ];
}

function renderFilters() {
  const container = $("#categoryFilters");

  if (!container) return;

  container.innerHTML = categories()
    .map(c => `
      <button
        class="filter ${c === state.category ? "active" : ""}"
        data-category="${escapeHtml(c)}"
      >
        ${escapeHtml(c)}
      </button>
    `)
    .join("");

  container.querySelectorAll(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      state.category = btn.dataset.category;
      renderAll();
    });
  });
}

function filteredApps() {
  const q = state.query.trim().toLowerCase();

  return state.apps.filter(a => {
    const cat =
      state.category === "Все" ||
      a.category === state.category;

    const text = `${a.name} ${a.id} ${a.description}`.toLowerCase();

    return cat && (!q || text.includes(q));
  });
}

function appCard(a) {
  return `
    <article class="app-card glass-panel">
      <div>
        <div class="app-top">
          <img
            class="app-icon"
            src="${escapeHtml(a.icon)}"
            alt=""
            loading="lazy"
            onerror="this.src='assets/images/gerastore-mark.svg'"
          >

          <div>
            <div class="app-title">
              ${escapeHtml(a.name)}
            </div>

            <div class="app-meta">
              v${escapeHtml(a.version)} · ${escapeHtml(a.ios)}
            </div>
          </div>
        </div>

        <p class="app-desc">
          ${escapeHtml(a.description)}
        </p>
      </div>

      <div class="app-bottom">
        <div class="app-tags">
          <span class="tag">
            ${escapeHtml(a.category)}
          </span>

          <span class="tag">
            ${escapeHtml(a.size)}
          </span>
        </div>

        ${
          a.download !== "#"
            ? `
              <a
                class="app-link"
                href="${escapeHtml(a.download)}"
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

function renderUpdates() {
  const container = $("#updatesGrid");

  if (!container) return;

  const apps = [...state.apps]
    .sort((a, b) =>
      String(b.updated).localeCompare(String(a.updated))
    )
    .slice(0, 6);

  container.innerHTML = apps.length
    ? apps.map(a => `
      <article class="update-card glass-panel">
        <div>
          <strong>${escapeHtml(a.name)}</strong>
          <span>${escapeHtml(a.updated)}</span>
        </div>

        <span class="update-version">
          v${escapeHtml(a.version)}
        </span>
      </article>
    `).join("")
    : `
      <div class="loading-card glass-panel">
        Данные об обновлениях появятся после подключения каталога.
      </div>
    `;
}

function renderStats() {
  const apps = $("[data-stat='apps']");
  const categoriesEl = $("[data-stat='categories']");
  const versions = $("[data-stat='versions']");

  if (apps) {
    apps.textContent = state.apps.length;
  }

  if (categoriesEl) {
    categoriesEl.textContent =
      categories().filter(x => x !== "Все").length;
  }

  if (versions) {
    versions.textContent =
      new Set(state.apps.map(a => a.version)).size;
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

  if (!input) return;

  input.addEventListener("input", e => {
    state.query = e.target.value;
    renderCatalog();
  });
}

function setupRepoCopy() {
  const button = $("#copyRepo");
  const status = $("#copyStatus");

  if (!button) return;

  button.addEventListener("click", async () => {
    const repoUrl =
      "https://raw.githubusercontent.com/gkuhtov/GeraStore/main/repo.json";

    try {
      await navigator.clipboard.writeText(repoUrl);

      if (status) {
        status.textContent =
          "Ссылка на репозиторий скопирована.";
      }
    } catch (e) {
      if (status) {
        status.textContent =
          "Скопируй ссылку вручную: " + repoUrl;
      }
    }
  });
}

/*
  HERO VIDEO

  Логика:

  1. Проверяем поддержку видео.
  2. Используем облегчённое background-web.mp4.
  3. Если видео загрузилось, показываем его.
  4. Если видео не загрузилось, остаётся hero-poster.
  5. При Save-Data видео отключается.
  6. При reduced-data видео отключается.
  7. При слабом соединении используем статичный фон.
*/

function setupHeroVideo() {
  const video = $("#heroVideo");
  const status = $("#mediaStatus");

  if (!video) return;

  const poster = document.querySelector(".hero-poster");

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

  /*
    Save Data.
  */
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

  /*
    Reduced Data.
  */
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-data: reduce)").matches
  ) {
    video.pause();
    video.removeAttribute("src");
    video.load();

    usePoster("Статичный режим");
    return;
  }

  /*
    Медленное соединение.
    На 2G/slow-2g видео отключаем.
  */
  const connection = navigator.connection;

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

  /*
    Устанавливаем облегчённое видео.
  */
  video.src = "assets/video/background-web.mp4";
  video.load();

  let ready = false;

  const timeout = setTimeout(() => {
    if (!ready) {
      usePoster("Статичный режим");
    }
  }, 8000);

  video.addEventListener("canplay", () => {
    ready = true;
    clearTimeout(timeout);
    useVideo();

    video.play().catch(() => {
      usePoster("Статичный режим");
    });
  }, { once: true });

  video.addEventListener("error", () => {
    clearTimeout(timeout);
    usePoster("Статичный режим");
  }, { once: true });

  video.addEventListener("stalled", () => {
    if (!ready) {
      usePoster("Статичный режим");
    }
  });

  video.addEventListener("abort", () => {
    if (!ready) {
      usePoster("Статичный режим");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSearch();
  setupRepoCopy();
  setupHeroVideo();
  loadApps();
});
