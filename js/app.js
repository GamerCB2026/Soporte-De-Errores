(function () {
  "use strict";

  var CATEGORIES = [
    "Error de imagen",
    "Error de carga",
    "Error de descarga",
    "Error de video",
    "Error de procesamiento",
    "Otro"
  ];

  var CAT_CLASS = {
    "Error de imagen": "imagen",
    "Error de carga": "carga",
    "Error de descarga": "descarga",
    "Error de video": "video",
    "Error de procesamiento": "proceso",
    "Otro": "otro"
  };

  var PAGES = [
    "Chart Editor GCD",
    "FNF Packer",
    "Chart Convert",
    "Stage Convert",
    "FNF Test Song Chart Editor GCD"
  ];

  var OLD_CATEGORY_TO_PAGE = {
    "Problemas Chart Editor GCD": "Chart Editor GCD",
    "Problemas FNF Packer": "FNF Packer",
    "Problemas Chart Convert": "Chart Convert",
    "Problemas Stage Convert": "Stage Convert",
    "Problema FNF Test Song Chart Editor GCD": "FNF Test Song Chart Editor GCD"
  };

  var ADMIN_EMAIL = "deibyrt107cali@gmail.com";
  var ADMIN_NAME = "GamerCB";
  var NAME_KEY = "soporte-errores-nombre";
  var PAGE_KEY = "soporte-errores-pagina";
  var NEWS_SEEN_KEY = "soporte-errores-last-news-seen";
  var DEVICE_KEY = "soporte-errores-device-id";
  var EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏"];
  var MAX_NAME = 60;
  var MAX_DESC = 4000;
  var MAX_NEWS_TITLE = 120;
  var MAX_NEWS_BODY = 8000;
  var MAX_FILE = 100 * 1024 * 1024;
  var MAX_FILES = 8;
  var RATE_MS = 4000;
  var BUCKET = "soporte-adjuntos";

  var cfg = window.SOPORTE_CONFIG || {};
  var setupEl = document.getElementById("setup");
  var appEl = document.getElementById("app");

  function isConfigured() {
    var url = String(cfg.supabaseUrl || "").trim();
    var key = String(cfg.supabaseAnonKey || "").trim();
    if (!url || !key) return false;
    if (/PEGA_AQUI|YOUR_|CAMBIA_AQUI|placeholder/i.test(url + key)) return false;
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.replace(/\/$/, ""))) {
      if (!/^https:\/\//i.test(url) || key.length < 20) return false;
    }
    return key.length >= 20;
  }

  if (!isConfigured()) {
    setupEl.hidden = false;
    return;
  }

  appEl.hidden = false;

  var supabaseLib = window.supabase;
  if (!supabaseLib || typeof supabaseLib.createClient !== "function") {
    setupEl.hidden = false;
    appEl.hidden = true;
    return;
  }

  var client = supabaseLib.createClient(String(cfg.supabaseUrl).trim().replace(/\/$/, ""), String(cfg.supabaseAnonKey).trim(), {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  var feed = document.getElementById("feed");
  var newsFeed = document.getElementById("news-feed");
  var filtersEl = document.getElementById("filters");
  var form = document.getElementById("composer");
  var newsForm = document.getElementById("news-composer");
  var nameInput = document.getElementById("name");
  var pageSelect = document.getElementById("page");
  var catSelect = document.getElementById("category");
  var descInput = document.getElementById("description");
  var filesInput = document.getElementById("files");
  var attachBtn = document.getElementById("attach");
  var previewsEl = document.getElementById("previews");
  var formError = document.getElementById("form-error");
  var fileHint = document.getElementById("file-hint");
  var sendBtn = document.getElementById("send");
  var composerMeta = document.getElementById("composer-meta");
  var metaSheet = document.getElementById("meta-sheet");
  var metaBackdrop = document.getElementById("meta-backdrop");
  var metaSave = document.getElementById("meta-save");
  var emojiPicker = document.getElementById("emoji-picker");
  var connDot = document.getElementById("conn-dot");
  var connText = document.getElementById("conn-text");
  var presenceEl = document.getElementById("presence");
  var lightbox = document.getElementById("lightbox");
  var lightboxBody = document.getElementById("lightbox-body");
  var lightboxClose = document.getElementById("lightbox-close");
  var tabErrors = document.getElementById("tab-errors");
  var tabNews = document.getElementById("tab-news");
  var newsBadge = document.getElementById("news-badge");
  var btnInstall = document.getElementById("btn-install");
  var btnNotify = document.getElementById("btn-notify");
  var btnLogin = document.getElementById("btn-login");
  var accountEl = document.getElementById("account");
  var btnLogout = document.getElementById("btn-logout");
  var authModal = document.getElementById("auth-modal");
  var authForm = document.getElementById("auth-form");
  var authEmail = document.getElementById("auth-email");
  var authPassword = document.getElementById("auth-password");
  var authError = document.getElementById("auth-error");
  var authCancel = document.getElementById("auth-cancel");
  var newsTitle = document.getElementById("news-title");
  var newsBody = document.getElementById("news-body");
  var newsFileInput = document.getElementById("news-file");
  var newsAttach = document.getElementById("news-attach");
  var newsPreview = document.getElementById("news-preview");
  var newsError = document.getElementById("news-error");
  var newsFileHint = document.getElementById("news-file-hint");
  var newsSend = document.getElementById("news-send");
  var newsCancel = document.getElementById("news-cancel");
  var newsComposerTitle = document.getElementById("news-composer-title");
  var toastEl = document.getElementById("toast");

  var pendingFiles = [];
  var newsPendingFiles = [];
  var existingNewsAtts = [];
  var editingNewsId = null;
  var reactionsList = [];
  var seenReactionIds = {};
  var seenIds = {};
  var seenNewsIds = {};
  var savedPage = "";
  try { savedPage = localStorage.getItem(PAGE_KEY) || ""; } catch (e) { savedPage = ""; }
  var activePage = PAGES.indexOf(savedPage) !== -1 ? savedPage : PAGES[0];
  var unreadPages = {};
  var activeTab = "errors";
  var lastSentAt = 0;
  var messagesCache = [];
  var newsCache = [];
  var currentUser = null;
  var deferredPrompt = null;
  var toastTimer = null;
  var clientId = "c-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  var presenceChannel = null;

  function isAdminSession() {
    var email = currentUser && currentUser.email ? String(currentUser.email).toLowerCase() : "";
    return email === ADMIN_EMAIL;
  }

  nameInput.value = localStorage.getItem(NAME_KEY) || "";

  function messagePage(row) {
    if (row && row.page && PAGES.indexOf(row.page) !== -1) return row.page;
    if (row && OLD_CATEGORY_TO_PAGE[row.category]) return OLD_CATEGORY_TO_PAGE[row.category];
    return PAGES[0];
  }

  CATEGORIES.forEach(function (c) {
    var opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    catSelect.appendChild(opt);
  });
  PAGES.forEach(function (pg) {
    var opt = document.createElement("option");
    opt.value = pg;
    opt.textContent = pg;
    pageSelect.appendChild(opt);
  });

  function setPageUnread(page, on) {
    if (on) unreadPages[page] = true;
    else delete unreadPages[page];
    var chip = filtersEl.querySelector('.chip[data-page="' + page.replace(/"/g, "") + '"]');
    if (chip) chip.classList.toggle("has-unread", !!unreadPages[page]);
  }

  function selectPage(page) {
    if (PAGES.indexOf(page) === -1) page = PAGES[0];
    activePage = page;
    try { localStorage.setItem(PAGE_KEY, page); } catch (e) {}
    setPageUnread(page, false);
    var chips = filtersEl.querySelectorAll(".chip");
    for (var i = 0; i < chips.length; i++) {
      chips[i].classList.toggle("active", chips[i].getAttribute("data-page") === page);
    }
    if (pageSelect.value !== page) pageSelect.value = page;
    updateComposerMeta();
    renderFeed();
  }

  function addPageChip(page) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (page === activePage ? " active" : "");
    btn.setAttribute("data-page", page);
    var lab = document.createElement("span");
    lab.textContent = page;
    btn.appendChild(lab);
    var dot = document.createElement("span");
    dot.className = "unread-dot";
    dot.setAttribute("aria-hidden", "true");
    btn.appendChild(dot);
    btn.addEventListener("click", function () { selectPage(page); });
    filtersEl.appendChild(btn);
  }
  PAGES.forEach(addPageChip);
  pageSelect.value = activePage;
  pageSelect.addEventListener("change", function () {
    if (pageSelect.value) selectPage(pageSelect.value);
  });

  function setConn(ok, text) {
    connDot.className = "dot " + (ok ? "on" : "off");
    connText.textContent = text;
  }

  function showError(el, msg) {
    if (!el) el = formError;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  function formatWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    function pad(n) { return String(n).padStart(2, "0"); }
    return pad(d.getDate()) + "/" + pad(d.getMonth() + 1) + "/" + d.getFullYear() + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function isAllowedFile(file, imagesOnly) {
    var t = (file && file.type) || "";
    if (imagesOnly) return t.indexOf("image/") === 0;
    return t.indexOf("image/") === 0 || t.indexOf("video/") === 0;
  }

  function safeFileName(name) {
    return String(name || "archivo")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/^\.+/, "_")
      .slice(0, 80) || "archivo";
  }

  function parseAttachments(raw) {
    if (!raw) return [];
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { return []; }
    }
    if (!Array.isArray(raw)) return [];
    return raw.filter(function (a) {
      return a && typeof a === "object" && typeof a.url === "string" && /^https?:\/\//i.test(a.url);
    });
  }

  function getDeviceId() {
    var id = "";
    try { id = localStorage.getItem(DEVICE_KEY) || ""; } catch (e) {}
    if (!id || id.length < 8) {
      if (typeof crypto !== "undefined" && crypto.randomUUID) id = "d-" + crypto.randomUUID();
      else id = "d-" + Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      id = id.slice(0, 80);
      try { localStorage.setItem(DEVICE_KEY, id); } catch (e) {}
    }
    return id;
  }

  function isVideoAtt(att) {
    return String((att && att.type) || "").indexOf("video/") === 0;
  }

  function newsMediaList(row) {
    var atts = parseAttachments(row && row.attachments);
    if (atts.length) return atts;
    if (row && row.image_url && /^https?:\/\//i.test(row.image_url)) {
      return [{ url: row.image_url, type: "image/*", name: row.title || "Imagen" }];
    }
    return [];
  }

  function firstImageUrl(atts) {
    for (var i = 0; i < atts.length; i++) {
      if (!isVideoAtt(atts[i])) return atts[i].url;
    }
    return null;
  }

  function renderMediaGrid(atts) {
    var grid = document.createElement("div");
    grid.className = "attach-grid";
    (atts || []).forEach(function (att) {
      var box = document.createElement("div");
      box.className = "media-box";
      if (isVideoAtt(att)) {
        var vid = document.createElement("video");
        vid.src = att.url;
        vid.controls = true;
        vid.preload = "metadata";
        vid.playsInline = true;
        box.appendChild(vid);
      } else {
        var img = document.createElement("img");
        img.src = att.url;
        img.alt = att.name || "Adjunto";
        img.addEventListener("click", function () { openLightbox(att); });
        box.appendChild(img);
      }
      grid.appendChild(box);
    });
    return grid;
  }

  function reactionsFor(type, id) {
    var counts = {};
    var mine = {};
    var device = getDeviceId();
    EMOJIS.forEach(function (e) { counts[e] = 0; mine[e] = false; });
    reactionsList.forEach(function (r) {
      if (r.target_type === type && r.target_id === id && counts[r.emoji] !== undefined) {
        counts[r.emoji]++;
        if (r.device_id === device) mine[r.emoji] = true;
      }
    });
    return { counts: counts, mine: mine };
  }

  function renderReactionsBar(type, id) {
    var bar = document.createElement("div");
    bar.className = "react-bar";
    bar.setAttribute("data-react", type + ":" + id);
    var info = reactionsFor(type, id);
    EMOJIS.forEach(function (emoji) {
      if (!info.counts[emoji]) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "react-btn" + (info.mine[emoji] ? " mine" : "");
      btn.setAttribute("aria-label", "Reaccionar con " + emoji);
      var em = document.createElement("span");
      em.textContent = emoji;
      btn.appendChild(em);
      var n = document.createElement("span");
      n.className = "react-count";
      n.textContent = String(info.counts[emoji]);
      btn.appendChild(n);
      btn.addEventListener("click", function () { toggleReaction(type, id, emoji); });
      bar.appendChild(btn);
    });
    var add = document.createElement("button");
    add.type = "button";
    add.className = "react-add";
    add.setAttribute("aria-label", "Añadir reacción");
    add.textContent = "☺+";
    add.addEventListener("click", function (e) {
      e.stopPropagation();
      openEmojiPicker(add, type, id);
    });
    bar.appendChild(add);
    return bar;
  }

  function refreshReactionBar(type, id) {
    closeEmojiPicker();
    var nodes = document.querySelectorAll('[data-react="' + type + ":" + id + '"]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].replaceWith(renderReactionsBar(type, id));
    }
  }

  function upsertReaction(row, opts) {
    if (!row || !row.id) return;
    if (seenReactionIds[row.id]) return;
    seenReactionIds[row.id] = true;
    reactionsList.push(row);
    if (!(opts && opts.silent)) refreshReactionBar(row.target_type, row.target_id);
  }

  function removeReactionLocal(row) {
    if (!row) return;
    var type = row.target_type;
    var tid = row.target_id;
    if (row.id) {
      for (var i = 0; i < reactionsList.length; i++) {
        if (reactionsList[i].id === row.id) {
          if (!type) type = reactionsList[i].target_type;
          if (!tid) tid = reactionsList[i].target_id;
          break;
        }
      }
      reactionsList = reactionsList.filter(function (r) { return r.id !== row.id; });
      delete seenReactionIds[row.id];
    } else {
      reactionsList = reactionsList.filter(function (r) {
        var drop = r.target_type === row.target_type && r.target_id === row.target_id && r.emoji === row.emoji && r.device_id === row.device_id;
        if (drop && r.id) delete seenReactionIds[r.id];
        return !drop;
      });
    }
    if (type && tid) refreshReactionBar(type, tid);
  }

  async function toggleReaction(type, id, emoji) {
    var device = getDeviceId();
    var info = reactionsFor(type, id);
    try {
      if (info.mine[emoji]) {
        var res = await client.from("reactions").delete()
          .eq("target_type", type)
          .eq("target_id", id)
          .eq("emoji", emoji)
          .eq("device_id", device)
          .select();
        if (res.error) throw res.error;
        if (res.data && res.data.length) {
          res.data.forEach(function (row) { removeReactionLocal(row); });
        } else {
          removeReactionLocal({ target_type: type, target_id: id, emoji: emoji, device_id: device });
        }
      } else {
        var ins = await client.from("reactions").insert({
          target_type: type,
          target_id: id,
          emoji: emoji,
          device_id: device
        }).select().single();
        if (ins.error) throw ins.error;
        upsertReaction(ins.data, {});
      }
    } catch (ex) {
      showToast("No se pudo guardar la reacción. ¿Ejecutaste supabase-update-3.sql?");
    }
  }

  async function loadReactions() {
    var res = await client.from("reactions").select("id, target_type, target_id, emoji, device_id").limit(5000);
    if (res.error) throw res.error;
    (res.data || []).forEach(function (row) { upsertReaction(row, { silent: true }); });
    if (activeTab === "errors") renderFeed();
    else renderNews();
  }

  async function deleteReactionsFor(type, id) {
    try { await client.from("reactions").delete().eq("target_type", type).eq("target_id", id); } catch (e) {}
    reactionsList = reactionsList.filter(function (r) {
      var drop = r.target_type === type && r.target_id === id;
      if (drop && r.id) delete seenReactionIds[r.id];
      return !drop;
    });
  }

  function badgeClass(category) {
    return CAT_CLASS[category] || "otro";
  }

  function openLightbox(att) {
    lightboxBody.textContent = "";
    var isVid = String(att.type || "").indexOf("video/") === 0;
    if (isVid) {
      var v = document.createElement("video");
      v.src = att.url;
      v.controls = true;
      v.autoplay = true;
      v.playsInline = true;
      lightboxBody.appendChild(v);
    } else {
      var img = document.createElement("img");
      img.src = att.url;
      img.alt = att.name || "Imagen";
      lightboxBody.appendChild(img);
    }
    lightbox.hidden = false;
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxBody.textContent = "";
  }

  lightboxClose.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", function (e) {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!lightbox.hidden) closeLightbox();
    else if (!authModal.hidden) closeAuth();
  });

  function showToast(text) {
    if (!text) return;
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 5000);
  }

  function notifyIcon() {
    try { return new URL("icons/icon-192.png", location.href).href; } catch (e) { return "icons/icon-192.png"; }
  }

  function canNotify() {
    return typeof Notification !== "undefined" && Notification.permission === "granted";
  }

  function sendNotification(title, body) {
    if (!canNotify()) return;
    try {
      new Notification(title, { body: body || "", icon: notifyIcon() });
    } catch (e) {}
  }

  function updateNotifyButton() {
    if (typeof Notification === "undefined") {
      btnNotify.hidden = true;
      return;
    }
    btnNotify.hidden = Notification.permission !== "default";
  }

  btnNotify.addEventListener("click", function () {
    if (typeof Notification === "undefined") return;
    Notification.requestPermission().then(function () { updateNotifyButton(); });
  });

  function lastNewsSeen() {
    return localStorage.getItem(NEWS_SEEN_KEY) || "";
  }

  function unseenNews() {
    var seen = lastNewsSeen();
    if (!seen) return newsCache.slice();
    return newsCache.filter(function (n) { return n.created_at && n.created_at > seen; });
  }

  function updateNewsBadge() {
    var n = unseenNews().length;
    if (n <= 0) {
      newsBadge.hidden = true;
      newsBadge.textContent = "0";
    } else {
      newsBadge.hidden = false;
      newsBadge.textContent = n > 99 ? "99+" : String(n);
    }
  }

  function markNewsSeen() {
    var maxTs = "";
    newsCache.forEach(function (n) {
      if (n.created_at && n.created_at > maxTs) maxTs = n.created_at;
    });
    if (!maxTs) maxTs = new Date().toISOString();
    try { localStorage.setItem(NEWS_SEEN_KEY, maxTs); } catch (e) {}
    updateNewsBadge();
  }

  function setTab(tab) {
    activeTab = tab;
    var errors = tab === "errors";
    tabErrors.classList.toggle("active", errors);
    tabNews.classList.toggle("active", !errors);
    feed.hidden = !errors;
    filtersEl.hidden = !errors;
    form.hidden = !errors;
    newsFeed.hidden = errors;
    newsForm.hidden = errors || !isAdminSession();
    if (!errors) {
      markNewsSeen();
      renderNews();
    }
  }

  tabErrors.addEventListener("click", function () { setTab("errors"); });
  tabNews.addEventListener("click", function () { setTab("news"); });

  function applyAccountUi() {
    var admin = isAdminSession();
    btnLogin.hidden = !!currentUser;
    accountEl.hidden = !admin && !currentUser;
    if (currentUser && !admin) {
      accountEl.hidden = false;
      document.getElementById("account-name").textContent = currentUser.email || "Cuenta";
      var tag = accountEl.querySelector(".admin-tag");
      if (tag) tag.hidden = true;
    } else if (admin) {
      document.getElementById("account-name").textContent = ADMIN_NAME;
      var tag2 = accountEl.querySelector(".admin-tag");
      if (tag2) tag2.hidden = false;
    }
    if (admin) {
      nameInput.value = ADMIN_NAME;
      nameInput.readOnly = true;
    } else {
      nameInput.readOnly = false;
      if (nameInput.value === ADMIN_NAME) {
        nameInput.value = localStorage.getItem(NAME_KEY) || "";
      }
    }
    if (activeTab === "news") newsForm.hidden = !admin;
    if (activeTab === "errors") renderFeed();
    else renderNews();
    trackPresence();
    updateComposerMeta();
  }

  function openAuth() {
    showError(authError, "");
    authModal.hidden = false;
    authEmail.focus();
  }
  function closeAuth() {
    authModal.hidden = true;
    authPassword.value = "";
  }
  btnLogin.addEventListener("click", openAuth);
  authCancel.addEventListener("click", closeAuth);
  authModal.addEventListener("click", function (e) {
    if (e.target === authModal) closeAuth();
  });

  async function doLogin() {
    showError(authError, "");
    var email = authEmail.value.trim();
    var password = authPassword.value;
    if (!email || !password) {
      showError(authError, "Escribe el correo y la contraseña.");
      return;
    }
    var res = await client.auth.signInWithPassword({ email: email, password: password });
    if (res.error) throw res.error;
    currentUser = res.data && res.data.user ? res.data.user : null;
    closeAuth();
    applyAccountUi();
  }

  authForm.addEventListener("submit", function (e) {
    e.preventDefault();
    doLogin().catch(function (ex) {
      showError(authError, (ex && ex.message) || "No se pudo iniciar sesión.");
    });
  });
  btnLogout.addEventListener("click", function () {
    client.auth.signOut().finally(function () {
      currentUser = null;
      applyAccountUi();
    });
  });

  function renderMessage(row) {
    var article = document.createElement("article");
    article.className = "msg";
    article.dataset.id = row.id;
    article.dataset.category = row.category || "";

    var head = document.createElement("div");
    head.className = "msg-head";

    var badge = document.createElement("span");
    badge.className = "badge " + badgeClass(row.category);
    badge.textContent = row.category || "";
    head.appendChild(badge);

    var when = document.createElement("time");
    when.className = "when";
    when.dateTime = row.created_at || "";
    when.textContent = formatWhen(row.created_at);
    head.appendChild(when);
    article.appendChild(head);

    var who = document.createElement("p");
    who.className = "who";
    var whoName = document.createElement("span");
    whoName.textContent = row.name || "Anónimo";
    who.appendChild(whoName);
    if (row.is_admin) {
      var tag = document.createElement("span");
      tag.className = "admin-tag";
      tag.textContent = "admin";
      who.appendChild(tag);
    }
    article.appendChild(who);

    var body = document.createElement("p");
    body.className = "body-text";
    body.textContent = row.description || "";
    article.appendChild(body);

    var atts = parseAttachments(row.attachments);
    if (atts.length) article.appendChild(renderMediaGrid(atts));
    article.appendChild(renderReactionsBar("message", row.id));

    var foot = document.createElement("div");
    foot.className = "msg-foot";
    var solvedBtn = document.createElement("button");
    solvedBtn.type = "button";
    var solved = !!row.solved;
    solvedBtn.className = "solved-btn" + (solved ? " is-solved" : "") + (isAdminSession() ? " can-toggle" : "");
    solvedBtn.textContent = solved ? "✓" : "✕";
    solvedBtn.title = solved ? "Solucionado" : "Pendiente";
    solvedBtn.setAttribute("aria-label", solved ? "Solucionado" : "Pendiente");
    if (isAdminSession()) {
      solvedBtn.addEventListener("click", function () { toggleSolved(row); });
    }
    foot.appendChild(solvedBtn);
    if (isAdminSession()) {
      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn ghost compact btn-del";
      delBtn.textContent = "Borrar";
      delBtn.setAttribute("aria-label", "Borrar reporte");
      delBtn.addEventListener("click", function () { deleteMessage(row); });
      foot.appendChild(delBtn);
    }
    article.appendChild(foot);
    return article;
  }

  function removeMessageLocal(id) {
    if (!id) return;
    messagesCache = messagesCache.filter(function (m) { return m.id !== id; });
    delete seenIds[id];
    var el = feed.querySelector('[data-id="' + id + '"]');
    if (el) el.remove();
    if (activeTab === "errors" && !feed.querySelector(".msg")) renderFeed();
  }

  async function deleteMessage(row) {
    if (!isAdminSession() || !row || !row.id) return;
    if (!window.confirm("¿Borrar este reporte? Se eliminará para todos.")) return;
    var res = await client.from("messages").delete().eq("id", row.id);
    if (res.error) {
      showToast("No se pudo borrar el reporte. ¿Ejecutaste supabase-update-2.sql?");
      return;
    }
    var paths = [];
    parseAttachments(row.attachments).forEach(function (att) {
      var path = att.path || storagePathFromPublicUrl(att.url);
      if (path && path.indexOf("noticias/") !== 0) paths.push(path);
    });
    if (paths.length) {
      try { await client.storage.from(BUCKET).remove(paths); } catch (e) {}
    }
    await deleteReactionsFor("message", row.id);
    removeMessageLocal(row.id);
  }

  async function toggleSolved(row) {
    if (!isAdminSession()) return;
    var next = !row.solved;
    var res = await client.rpc("set_message_solved", { p_id: row.id, p_solved: next });
    if (res.error) {
      showToast("No se pudo actualizar el estado. ¿Ejecutaste supabase-update.sql?");
      return;
    }
    upsertMessage(res.data || Object.assign({}, row, { solved: next }), { silent: false, replace: true });
  }

  function renderFeed() {
    if (activeTab !== "errors") return;
    var nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
    feed.textContent = "";
    var list = messagesCache.filter(function (m) { return messagePage(m) === activePage; });
    if (!list.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = messagesCache.length
        ? "No hay reportes en esta página."
        : "Aún no hay reportes en esta página. Sé el primero en escribir.";
      feed.appendChild(empty);
      return;
    }
    list.forEach(function (row) { feed.appendChild(renderMessage(row)); });
    if (nearBottom) feed.scrollTop = feed.scrollHeight;
  }

  function findMessage(id) {
    for (var i = 0; i < messagesCache.length; i++) {
      if (messagesCache[i].id === id) return messagesCache[i];
    }
    return null;
  }

  function upsertMessage(row, opts) {
    if (!row || !row.id) return;
    opts = opts || {};
    var existing = findMessage(row.id);
    if (existing) {
      Object.keys(row).forEach(function (k) { existing[k] = row[k]; });
      if (opts.silent) return;
      if (activeTab !== "errors") return;
      if (messagePage(existing) !== activePage) return;
      var el = feed.querySelector('[data-id="' + row.id + '"]');
      if (el) el.replaceWith(renderMessage(existing));
      else renderFeed();
      return;
    }
    seenIds[row.id] = true;
    messagesCache.push(row);
    messagesCache.sort(function (a, b) {
      return new Date(a.created_at) - new Date(b.created_at);
    });
    if (opts.silent) return;
    var rowPage = messagePage(row);
    if (opts.forceScroll && rowPage !== activePage) {
      selectPage(rowPage);
      return;
    }
    if (rowPage !== activePage) {
      setPageUnread(rowPage, true);
      return;
    }
    if (activeTab !== "errors") return;
    if (opts.append) {
      var empty = feed.querySelector(".empty");
      if (empty) empty.remove();
      var wasNear = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 120;
      feed.appendChild(renderMessage(row));
      if (wasNear || opts.forceScroll) feed.scrollTop = feed.scrollHeight;
    } else {
      renderFeed();
    }
  }

  function renderNewsCard(row) {
    var card = document.createElement("article");
    card.className = "news-card";
    card.dataset.id = row.id;
    var top = document.createElement("div");
    top.className = "news-top";
    var title = document.createElement("h3");
    title.textContent = row.title || "";
    top.appendChild(title);
    if (isAdminSession()) {
      var actions = document.createElement("div");
      actions.className = "news-actions";
      var edit = document.createElement("button");
      edit.type = "button";
      edit.className = "btn ghost compact btn-edit";
      edit.textContent = "Editar";
      edit.addEventListener("click", function () { startEditNews(row); });
      actions.appendChild(edit);
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn ghost compact btn-del";
      del.textContent = "Borrar";
      del.addEventListener("click", function () { deleteNews(row); });
      actions.appendChild(del);
      top.appendChild(actions);
    }
    card.appendChild(top);
    var when = document.createElement("time");
    when.className = "when";
    when.dateTime = row.updated_at || row.created_at || "";
    when.textContent = formatWhen(row.created_at);
    if (row.updated_at && (!row.created_at || new Date(row.updated_at) - new Date(row.created_at) > 1000)) {
      var ed = document.createElement("span");
      ed.className = "edited-tag";
      ed.textContent = "(editado)";
      when.appendChild(ed);
    }
    card.appendChild(when);
    var body = document.createElement("p");
    body.className = "body-text";
    body.textContent = row.body || "";
    card.appendChild(body);
    var media = newsMediaList(row);
    if (media.length) card.appendChild(renderMediaGrid(media));
    card.appendChild(renderReactionsBar("news", row.id));
    return card;
  }

  function renderNews() {
    if (activeTab !== "news") return;
    newsFeed.textContent = "";
    if (!newsCache.length) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Todavía no hay noticias.";
      newsFeed.appendChild(empty);
      return;
    }
    newsCache.forEach(function (row) { newsFeed.appendChild(renderNewsCard(row)); });
  }

  function upsertNews(row, opts) {
    if (!row || !row.id) return;
    opts = opts || {};
    var existing = null;
    for (var i = 0; i < newsCache.length; i++) {
      if (newsCache[i].id === row.id) { existing = newsCache[i]; break; }
    }
    if (existing) {
      Object.keys(row).forEach(function (k) { existing[k] = row[k]; });
      if (!opts.silent && activeTab === "news") renderNews();
      return;
    }
    seenNewsIds[row.id] = true;
    newsCache.push(row);
    newsCache.sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    updateNewsBadge();
    if (opts.silent) return;
    if (opts.notify) {
      showToast("Nueva noticia: " + (row.title || "Sin título"));
      sendNotification("Soporte de errores", row.title || "Hay una noticia nueva");
    }
    if (activeTab === "news") {
      markNewsSeen();
      renderNews();
    }
  }

  function storagePathFromPublicUrl(url) {
    var marker = "/object/public/" + BUCKET + "/";
    var i = String(url || "").indexOf(marker);
    if (i < 0) return null;
    return decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  }

  async function deleteNews(row) {
    if (!isAdminSession()) return;
    if (!window.confirm("¿Borrar esta noticia?")) return;
    var res = await client.from("news").delete().eq("id", row.id);
    if (res.error) {
      showToast("No se pudo borrar la noticia.");
      return;
    }
    var paths = [];
    newsMediaList(row).forEach(function (att) {
      var path = att.path || storagePathFromPublicUrl(att.url);
      if (path) paths.push(path);
    });
    if (paths.length) {
      try { await client.storage.from(BUCKET).remove(paths); } catch (e) {}
    }
    await deleteReactionsFor("news", row.id);
    if (editingNewsId === row.id) resetNewsForm();
    newsCache = newsCache.filter(function (n) { return n.id !== row.id; });
    delete seenNewsIds[row.id];
    updateNewsBadge();
    renderNews();
  }

  function renderPreviews() {
    previewsEl.textContent = "";
    if (!pendingFiles.length) {
      previewsEl.hidden = true;
      fileHint.textContent = "";
      return;
    }
    previewsEl.hidden = false;
    fileHint.textContent = pendingFiles.length + (pendingFiles.length === 1 ? " archivo" : " archivos");
    pendingFiles.forEach(function (file, idx) {
      var item = document.createElement("div");
      item.className = "preview-item";
      if (file.type.indexOf("video/") === 0) {
        var v = document.createElement("video");
        v.src = URL.createObjectURL(file);
        v.muted = true;
        v.preload = "metadata";
        item.appendChild(v);
      } else {
        var img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.alt = file.name;
        item.appendChild(img);
      }
      var cap = document.createElement("span");
      cap.className = "preview-name";
      cap.textContent = file.name;
      item.appendChild(cap);
      var rm = document.createElement("button");
      rm.type = "button";
      rm.setAttribute("aria-label", "Quitar " + file.name);
      rm.textContent = "×";
      rm.addEventListener("click", function () {
        pendingFiles.splice(idx, 1);
        renderPreviews();
      });
      item.appendChild(rm);
      previewsEl.appendChild(item);
    });
  }

  function addFiles(list) {
    var errors = [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (pendingFiles.length >= MAX_FILES) {
        errors.push("Puedes adjuntar como máximo " + MAX_FILES + " archivos por mensaje.");
        break;
      }
      if (!isAllowedFile(f, false)) {
        errors.push("«" + f.name + "» no es una foto o un video.");
        continue;
      }
      if (f.size > MAX_FILE) {
        errors.push("«" + f.name + "» pesa más de 100 MB.");
        continue;
      }
      pendingFiles.push(f);
    }
    renderPreviews();
    showError(formError, errors[0] || "");
    filesInput.value = "";
  }

  attachBtn.addEventListener("click", function () { filesInput.click(); });
  filesInput.addEventListener("change", function () { addFiles(filesInput.files || []); });

  form.addEventListener("dragover", function (e) { e.preventDefault(); });
  form.addEventListener("drop", function (e) {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
  });

  nameInput.addEventListener("change", function () {
    if (isAdminSession()) {
      nameInput.value = ADMIN_NAME;
      updateComposerMeta();
      return;
    }
    var n = nameInput.value.trim().slice(0, MAX_NAME);
    nameInput.value = n;
    try { localStorage.setItem(NAME_KEY, n); } catch (e) {}
    trackPresence();
    updateComposerMeta();
  });
  nameInput.addEventListener("input", updateComposerMeta);
  catSelect.addEventListener("change", updateComposerMeta);

  function isMobileChat() {
    return window.matchMedia && window.matchMedia("(max-width: 700px)").matches;
  }

  function clearFieldHighlights() {
    nameInput.classList.remove("field-missing");
    pageSelect.classList.remove("field-missing");
    catSelect.classList.remove("field-missing");
    var fields = form.querySelectorAll(".field-missing");
    for (var i = 0; i < fields.length; i++) fields[i].classList.remove("field-missing");
  }

  function highlightField(el) {
    el.classList.add("field-missing");
    if (el.parentElement && el.parentElement.classList.contains("field")) {
      el.parentElement.classList.add("field-missing");
    }
  }

  function updateComposerMeta() {
    if (!composerMeta) return;
    var page = pageSelect.value || "Página";
    var type = catSelect.value || "Tipo";
    var name = (nameInput.value || "").trim() || "Nombre";
    composerMeta.textContent = page + " · " + type + " · " + name;
  }

  function openMetaSheet(focusEl) {
    if (!isMobileChat()) {
      if (focusEl && focusEl.focus) focusEl.focus();
      return;
    }
    appEl.classList.add("sheet-open");
    if (metaBackdrop) metaBackdrop.hidden = false;
    if (focusEl && focusEl.focus) {
      setTimeout(function () { focusEl.focus(); }, 50);
    }
  }

  function closeMetaSheet() {
    appEl.classList.remove("sheet-open");
    if (metaBackdrop) metaBackdrop.hidden = true;
    clearFieldHighlights();
    updateComposerMeta();
    var n = nameInput.value.trim().slice(0, MAX_NAME);
    if (n && !isAdminSession()) {
      try { localStorage.setItem(NAME_KEY, n); } catch (e) {}
    }
  }

  function autosizeDesc() {
    if (!descInput) return;
    if (!isMobileChat()) {
      descInput.style.height = "";
      return;
    }
    descInput.style.height = "auto";
    var max = 104;
    var min = 40;
    descInput.style.height = Math.min(max, Math.max(min, descInput.scrollHeight)) + "px";
  }

  function scrollFeedToEnd() {
    if (activeTab === "errors") feed.scrollTop = feed.scrollHeight;
  }

  function syncVisualViewport() {
    var vv = window.visualViewport;
    if (!isMobileChat() || !vv) {
      appEl.style.height = "";
      appEl.style.transform = "";
      appEl.classList.remove("kb-open");
      return;
    }
    appEl.style.height = vv.height + "px";
    appEl.style.transform = vv.offsetTop ? "translateY(" + vv.offsetTop + "px)" : "";
    var kb = window.innerHeight - vv.height > 80;
    var was = appEl.classList.contains("kb-open");
    appEl.classList.toggle("kb-open", kb);
    if (kb && !was) {
      var near = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 160;
      if (near) scrollFeedToEnd();
    }
  }

  function setSending(on) {
    sendBtn.disabled = on;
    var lab = sendBtn.querySelector(".send-label");
    if (lab) lab.textContent = on ? "Enviando…" : "Enviar";
    sendBtn.setAttribute("aria-label", on ? "Enviando…" : "Enviar");
  }

  function validate() {
    clearFieldHighlights();
    var name = nameInput.value.trim();
    var page = pageSelect.value;
    var cat = catSelect.value;
    var desc = descInput.value.trim();
    if (isAdminSession()) name = ADMIN_NAME;
    if (!name) {
      highlightField(nameInput);
      if (isMobileChat()) openMetaSheet(nameInput);
      return "Escribe tu nombre.";
    }
    if (name.length > MAX_NAME) return "El nombre es demasiado largo.";
    if (!page || PAGES.indexOf(page) === -1) {
      highlightField(pageSelect);
      if (isMobileChat()) openMetaSheet(pageSelect);
      return "Selecciona una página.";
    }
    if (!cat || CATEGORIES.indexOf(cat) === -1) {
      highlightField(catSelect);
      if (isMobileChat()) openMetaSheet(catSelect);
      return "Selecciona un tipo de error.";
    }
    if (!desc) return "Describe el error que tienes. Es obligatorio.";
    if (desc.length > MAX_DESC) return "La descripción es demasiado larga.";
    if (Date.now() - lastSentAt < RATE_MS) return "Espera unos segundos antes de enviar otro mensaje.";
    return null;
  }

  async function uploadOne(file, folder) {
    var prefix = folder ? folder.replace(/\/+$/, "") + "/" : "";
    var path = prefix + Date.now() + "-" + Math.random().toString(36).slice(2, 10) + "-" + safeFileName(file.name);
    var res = await client.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "3600"
    });
    if (res.error) throw new Error(res.error.message || "No se pudo subir el archivo.");
    var pub = client.storage.from(BUCKET).getPublicUrl(path);
    var url = pub && pub.data && pub.data.publicUrl;
    if (!url) throw new Error("No se obtuvo la URL pública del archivo.");
    return { url: url, type: file.type, name: file.name, path: path };
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError(formError, "");
    var err = validate();
    if (err) { showError(formError, err); return; }

    var name = isAdminSession() ? ADMIN_NAME : nameInput.value.trim().slice(0, MAX_NAME);
    var page = pageSelect.value;
    var category = catSelect.value;
    var description = descInput.value.trim().slice(0, MAX_DESC);
    if (!isAdminSession()) {
      try { localStorage.setItem(NAME_KEY, name); } catch (err2) {}
    }

    setSending(true);
    if (form) form.classList.add("uploading");

    try {
      var attachments = [];
      for (var i = 0; i < pendingFiles.length; i++) {
        fileHint.textContent = "Subiendo " + (i + 1) + " de " + pendingFiles.length + "…";
        attachments.push(await uploadOne(pendingFiles[i], ""));
      }
      var ins = await client.from("messages").insert({
        name: name,
        page: page,
        category: category,
        description: description,
        attachments: attachments
      }).select().single();
      if (ins.error) throw new Error(ins.error.message || "No se pudo enviar el mensaje.");
      lastSentAt = Date.now();
      upsertMessage(ins.data, { append: true, forceScroll: true });
      descInput.value = "";
      pendingFiles = [];
      renderPreviews();
      fileHint.textContent = "";
      if (form) form.classList.remove("uploading");
      autosizeDesc();
      scrollFeedToEnd();
    } catch (ex) {
      showError(formError, ex && ex.message ? ("No se pudo enviar. " + ex.message) : "No se pudo enviar. Revisa la conexión o que hayas ejecutado supabase-update-2.sql.");
    } finally {
      setSending(false);
      if (form) form.classList.remove("uploading");
    }
  });

  function newsPreviewItem(src, isVid, name, onRemove) {
    var item = document.createElement("div");
    item.className = "preview-item";
    if (isVid) {
      var v = document.createElement("video");
      v.src = src;
      v.muted = true;
      v.preload = "metadata";
      item.appendChild(v);
    } else {
      var img = document.createElement("img");
      img.src = src;
      img.alt = name || "";
      item.appendChild(img);
    }
    var cap = document.createElement("span");
    cap.className = "preview-name";
    cap.textContent = name || "";
    item.appendChild(cap);
    var rm = document.createElement("button");
    rm.type = "button";
    rm.setAttribute("aria-label", "Quitar " + (name || "archivo"));
    rm.textContent = "×";
    rm.addEventListener("click", onRemove);
    item.appendChild(rm);
    return item;
  }

  function renderNewsPreview() {
    newsPreview.textContent = "";
    var total = existingNewsAtts.length + newsPendingFiles.length;
    if (!total) {
      newsPreview.hidden = true;
      newsFileHint.textContent = "";
      return;
    }
    newsPreview.hidden = false;
    newsFileHint.textContent = total + (total === 1 ? " archivo" : " archivos");
    existingNewsAtts.forEach(function (att, idx) {
      newsPreview.appendChild(newsPreviewItem(att.url, isVideoAtt(att), att.name, function () {
        existingNewsAtts.splice(idx, 1);
        renderNewsPreview();
      }));
    });
    newsPendingFiles.forEach(function (file, idx) {
      newsPreview.appendChild(newsPreviewItem(URL.createObjectURL(file), file.type.indexOf("video/") === 0, file.name, function () {
        newsPendingFiles.splice(idx, 1);
        renderNewsPreview();
      }));
    });
  }

  function addNewsFiles(list) {
    var errors = [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      if (existingNewsAtts.length + newsPendingFiles.length >= MAX_FILES) {
        errors.push("Puedes adjuntar como máximo " + MAX_FILES + " archivos por noticia.");
        break;
      }
      if (!isAllowedFile(f, false)) {
        errors.push("«" + f.name + "» no es una foto o un video.");
        continue;
      }
      if (f.size > MAX_FILE) {
        errors.push("«" + f.name + "» pesa más de 100 MB.");
        continue;
      }
      newsPendingFiles.push(f);
    }
    renderNewsPreview();
    showError(newsError, errors[0] || "");
    newsFileInput.value = "";
  }

  function resetNewsForm() {
    editingNewsId = null;
    existingNewsAtts = [];
    newsPendingFiles = [];
    newsTitle.value = "";
    newsBody.value = "";
    if (newsComposerTitle) newsComposerTitle.textContent = "Nueva noticia";
    newsSend.textContent = "Publicar";
    if (newsCancel) newsCancel.hidden = true;
    renderNewsPreview();
    showError(newsError, "");
  }

  function startEditNews(row) {
    if (!isAdminSession() || !row) return;
    editingNewsId = row.id;
    newsTitle.value = row.title || "";
    newsBody.value = row.body || "";
    existingNewsAtts = newsMediaList(row).slice();
    newsPendingFiles = [];
    if (newsComposerTitle) newsComposerTitle.textContent = "Editar noticia";
    newsSend.textContent = "Guardar";
    if (newsCancel) newsCancel.hidden = false;
    renderNewsPreview();
    showError(newsError, "");
    if (newsForm && newsForm.scrollIntoView) newsForm.scrollIntoView({ block: "nearest" });
    newsTitle.focus();
  }

  newsAttach.addEventListener("click", function () { newsFileInput.click(); });
  newsFileInput.addEventListener("change", function () { addNewsFiles(newsFileInput.files || []); });
  if (newsCancel) newsCancel.addEventListener("click", function () { resetNewsForm(); });

  newsForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    showError(newsError, "");
    if (!isAdminSession()) {
      showError(newsError, "Solo el administrador puede publicar noticias.");
      return;
    }
    var title = newsTitle.value.trim().slice(0, MAX_NEWS_TITLE);
    var body = newsBody.value.trim().slice(0, MAX_NEWS_BODY);
    if (!title) { showError(newsError, "Escribe un título."); return; }
    if (!body) { showError(newsError, "Escribe el texto de la noticia."); return; }
    if (editingNewsId && !window.confirm("¿Guardar los cambios de esta noticia?")) return;
    var editing = !!editingNewsId;
    newsSend.disabled = true;
    newsSend.textContent = editing ? "Guardando…" : "Publicando…";
    try {
      var attachments = existingNewsAtts.slice();
      for (var i = 0; i < newsPendingFiles.length; i++) {
        newsFileHint.textContent = "Subiendo " + (i + 1) + " de " + newsPendingFiles.length + "…";
        attachments.push(await uploadOne(newsPendingFiles[i], "noticias"));
      }
      var payload = {
        title: title,
        body: body,
        attachments: attachments,
        image_url: firstImageUrl(attachments)
      };
      var saved;
      if (editing) {
        var prev = null;
        for (var n = 0; n < newsCache.length; n++) {
          if (newsCache[n].id === editingNewsId) prev = newsCache[n];
        }
        var upd = await client.from("news").update(payload).eq("id", editingNewsId).select().single();
        if (upd.error) throw new Error(upd.error.message || "No se pudo guardar.");
        saved = upd.data;
        var keep = {};
        attachments.forEach(function (a) {
          var path = a.path || storagePathFromPublicUrl(a.url);
          if (path) keep[path] = true;
        });
        var removed = [];
        newsMediaList(prev || {}).forEach(function (att) {
          var path = att.path || storagePathFromPublicUrl(att.url);
          if (path && !keep[path]) removed.push(path);
        });
        if (removed.length) {
          try { await client.storage.from(BUCKET).remove(removed); } catch (err3) {}
        }
        upsertNews(saved, { silent: false, notify: false });
        showToast("Noticia actualizada.");
      } else {
        var ins = await client.from("news").insert(payload).select().single();
        if (ins.error) throw new Error(ins.error.message || "No se pudo publicar.");
        saved = ins.data;
        upsertNews(saved, { silent: false, notify: false });
        showToast("Noticia publicada.");
      }
      resetNewsForm();
    } catch (ex) {
      showError(newsError, (ex && ex.message) ? ex.message : "No se pudo guardar la noticia. ¿Ejecutaste supabase-update-3.sql?");
      newsSend.textContent = editingNewsId ? "Guardar" : "Publicar";
    } finally {
      newsSend.disabled = false;
      if (!editingNewsId) newsSend.textContent = "Publicar";
    }
  });

  var pickerTarget = null;
  function closeEmojiPicker() {
    if (!emojiPicker) return;
    emojiPicker.hidden = true;
    pickerTarget = null;
  }

  function openEmojiPicker(anchor, type, id) {
    if (!emojiPicker) return;
    if (pickerTarget && pickerTarget.type === type && pickerTarget.id === id && !emojiPicker.hidden) {
      closeEmojiPicker();
      return;
    }
    pickerTarget = { type: type, id: id };
    var info = reactionsFor(type, id);
    emojiPicker.textContent = "";
    EMOJIS.forEach(function (emoji) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = emoji;
      if (info.mine[emoji]) btn.className = "mine";
      btn.setAttribute("aria-label", emoji);
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleReaction(type, id, emoji);
        closeEmojiPicker();
      });
      emojiPicker.appendChild(btn);
    });
    emojiPicker.hidden = false;
    var r = anchor.getBoundingClientRect();
    var w = 236;
    var left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left));
    var top = r.top - 8;
    emojiPicker.style.left = left + "px";
    emojiPicker.style.top = "0px";
    var ph = emojiPicker.offsetHeight || 96;
    top = r.top - ph - 8;
    if (top < 8) top = r.bottom + 8;
    emojiPicker.style.top = top + "px";
  }

  if (composerMeta) composerMeta.addEventListener("click", function () { openMetaSheet(nameInput); });
  if (metaSave) metaSave.addEventListener("click", closeMetaSheet);
  if (metaBackdrop) metaBackdrop.addEventListener("click", closeMetaSheet);
  if (metaSheet) {
    metaSheet.addEventListener("click", function (e) {
      if (e.target === metaSheet) closeMetaSheet();
    });
  }

  form.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    if (e.target === descInput) return;
    if (e.target === nameInput || e.target === pageSelect || e.target === catSelect) {
      e.preventDefault();
      if (isMobileChat()) closeMetaSheet();
    }
  });

  descInput.addEventListener("input", autosizeDesc);

  document.addEventListener("click", function (e) {
    if (emojiPicker && !emojiPicker.hidden && !emojiPicker.contains(e.target) && !(e.target.closest && e.target.closest(".react-add"))) {
      closeEmojiPicker();
    }
  });

  var feedScrollY = 0;
  function onFeedScroll() {
    closeEmojiPicker();
    if (!isMobileChat()) {
      appEl.classList.remove("chrome-collapsed");
      return;
    }
    var y = feed.scrollTop;
    if (y > feedScrollY + 10 && y > 20) appEl.classList.add("chrome-collapsed");
    else if (y < feedScrollY - 10) appEl.classList.remove("chrome-collapsed");
    feedScrollY = y;
  }
  feed.addEventListener("scroll", onFeedScroll, { passive: true });
  newsFeed.addEventListener("scroll", function () {
    closeEmojiPicker();
    if (!isMobileChat()) return;
    var y = newsFeed.scrollTop;
    if (y > 20) appEl.classList.add("chrome-collapsed");
    else appEl.classList.remove("chrome-collapsed");
  }, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncVisualViewport);
    window.visualViewport.addEventListener("scroll", syncVisualViewport);
  }
  window.addEventListener("resize", function () {
    syncVisualViewport();
    autosizeDesc();
    if (!isMobileChat()) closeMetaSheet();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (emojiPicker && !emojiPicker.hidden) closeEmojiPicker();
    else if (appEl.classList.contains("sheet-open")) closeMetaSheet();
  });

  updateComposerMeta();
  autosizeDesc();
  syncVisualViewport();

    async function loadHistory() {
    var res = await client
      .from("messages")
      .select("id, created_at, name, page, category, description, attachments, solved, is_admin")
      .order("created_at", { ascending: true })
      .limit(500);
    if (res.error) throw res.error;
    (res.data || []).forEach(function (row) { upsertMessage(row, { silent: true }); });
    renderFeed();
    feed.scrollTop = feed.scrollHeight;
  }

  async function loadNews() {
    var res = await client
      .from("news")
      .select("id, created_at, updated_at, title, body, image_url, attachments")
      .order("created_at", { ascending: false })
      .limit(200);
    if (res.error) throw res.error;
    (res.data || []).forEach(function (row) { upsertNews(row, { silent: true }); });
    updateNewsBadge();
    if (activeTab === "news") renderNews();

    var firstVisit = !localStorage.getItem(NEWS_SEEN_KEY);
    var unseen = unseenNews();
    if (!firstVisit && unseen.length) {
      var msg = unseen.length === 1
        ? "Hay 1 noticia nueva desde tu última visita."
        : "Hay " + unseen.length + " noticias nuevas desde tu última visita.";
      showToast(msg);
      sendNotification("Soporte de errores", msg);
    }
  }

  function trackPresence() {
    if (!presenceChannel) return;
    var n = isAdminSession() ? ADMIN_NAME : ((nameInput.value || "").trim() || "Visitante");
    presenceChannel.track({ name: n.slice(0, MAX_NAME) }).catch(function () {});
  }

  function startRealtime() {
    var ch = client.channel("soporte-sala", { config: { presence: { key: clientId } } });
    presenceChannel = ch;

    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, function (payload) {
      if (payload && payload.new) upsertMessage(payload.new, { append: true });
    });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, function (payload) {
      if (payload && payload.new) upsertMessage(payload.new, { replace: true });
    });
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, function (payload) {
      var old = payload && payload.old;
      if (old && old.id) removeMessageLocal(old.id);
    });
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "news" }, function (payload) {
      if (payload && payload.new) upsertNews(payload.new, { notify: true });
    });
    ch.on("postgres_changes", { event: "UPDATE", schema: "public", table: "news" }, function (payload) {
      if (payload && payload.new) upsertNews(payload.new, { notify: false });
    });
    ch.on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, function (payload) {
      if (payload && payload.new) upsertReaction(payload.new, {});
    });
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "reactions" }, function (payload) {
      if (payload && payload.old) removeReactionLocal(payload.old);
    });
    ch.on("postgres_changes", { event: "DELETE", schema: "public", table: "news" }, function (payload) {
      var old = payload && payload.old;
      if (!old || !old.id) return;
      newsCache = newsCache.filter(function (n) { return n.id !== old.id; });
      delete seenNewsIds[old.id];
      updateNewsBadge();
      if (activeTab === "news") renderNews();
    });

    ch.on("presence", { event: "sync" }, function () {
      var state = ch.presenceState() || {};
      var n = Object.keys(state).length;
      if (n <= 0) {
        presenceEl.textContent = "";
        presenceEl.removeAttribute("title");
      } else {
        presenceEl.textContent = String(n);
        presenceEl.title = n === 1 ? "1 persona en línea" : n + " personas en línea";
        presenceEl.setAttribute("aria-label", presenceEl.title);
      }
    });

    ch.subscribe(function (status) {
      if (status === "SUBSCRIBED") {
        setConn(true, "En vivo");
        trackPresence();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConn(false, "Sin tiempo real");
      } else if (status === "CLOSED") {
        setConn(false, "Desconectado");
      }
    });
  }

  /* PWA */
  function canUseSW() {
    return (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1");
  }

  if (canUseSW() && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return;
    btnInstall.hidden = false;
  });
  btnInstall.addEventListener("click", function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null;
      btnInstall.hidden = true;
    });
  });
  window.addEventListener("appinstalled", function () {
    btnInstall.hidden = true;
    deferredPrompt = null;
  });

  updateNotifyButton();

  client.auth.getSession().then(function (res) {
    currentUser = res.data && res.data.session ? res.data.session.user : null;
    applyAccountUi();
  }).catch(function () {});

  client.auth.onAuthStateChange(function (_event, session) {
    currentUser = session && session.user ? session.user : null;
    applyAccountUi();
  });

  loadHistory()
    .then(function () {
      setConn(true, "Conectado");
      startRealtime();
      return loadNews().catch(function () {
        /* Las noticias requieren supabase-update.sql / update-3.sql */
      }).then(function () {
        return loadReactions().catch(function () {});
      });
    })
    .catch(function (ex) {
      setConn(false, "Error de conexión");
      feed.textContent = "";
      var p = document.createElement("p");
      p.className = "feed-error";
      p.textContent = "No se pudieron cargar los mensajes. Ejecuta supabase-update.sql y supabase-update-2.sql en Supabase y recarga con Ctrl+F5. " + (ex && ex.message ? ex.message : "");
      feed.appendChild(p);
    });
})();
