(function () {
  "use strict";

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Header: sticky state + scroll progress ---------- */
  var header = $(".site-header");
  var progressBar = $("#progressBar");
  var toTop = $("#toTop");

  function onScroll() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    if (header) header.classList.toggle("is-stuck", y > 8);
    if (toTop) toTop.classList.toggle("is-visible", y > 560);
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    if (progressBar) progressBar.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Mobile navigation ---------- */
  var navToggle = $("#navToggle");
  var navMenu = $(".nav-menu");
  var navLinks = $("#navLinks");

  function setNav(open) {
    if (!navToggle || !navMenu) return;
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.setAttribute("aria-label", open ? "关闭导航菜单" : "打开导航菜单");
    navMenu.classList.toggle("is-open", open);
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      setNav(navToggle.getAttribute("aria-expanded") !== "true");
    });
    if (navLinks) {
      $$("a", navLinks).forEach(function (a) {
        a.addEventListener("click", function () { setNav(false); });
      });
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navMenu.classList.contains("is-open")) setNav(false);
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 720) setNav(false);
    });
  }

  /* ---------- Active section in nav ---------- */
  var sectionIds = ["about", "honors", "certificates", "projects", "contact"];
  var navAnchors = {};
  sectionIds.forEach(function (id) {
    var a = navLinks ? $('a[href="#' + id + '"]', navLinks) : null;
    if (a) navAnchors[id] = a;
  });

  if ("IntersectionObserver" in window && Object.keys(navAnchors).length) {
    var currentId = "";
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        if (id === currentId) return;
        currentId = id;
        Object.keys(navAnchors).forEach(function (key) {
          navAnchors[key].classList.toggle("is-active", key === id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    sectionIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealItems = $$(".reveal");
  if ("IntersectionObserver" in window && revealItems.length) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = Number(el.dataset.delay || 0);
        window.setTimeout(function () { el.classList.add("is-in"); }, delay);
        revealObserver.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    revealItems.forEach(function (el) {
      var siblings = el.parentElement ? $$(".reveal", el.parentElement) : [];
      var idx = siblings.indexOf(el);
      if (idx > 0) el.dataset.delay = String(Math.min(idx, 6) * 60);
      revealObserver.observe(el);
    });
  } else {
    revealItems.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Category filters ---------- */
  function initFilters(groupSelector, itemSelector, itemScope, emptyEl) {
    $$(groupSelector).forEach(function (group) {
      var buttons = $$(".filter", group);
      var scope = document.querySelector(itemScope);
      if (!scope) return;

      var items = $$(itemSelector, scope);
      var counts = { all: items.length };

      items.forEach(function (item) {
        var cat = item.dataset.cat || "other";
        counts[cat] = (counts[cat] || 0) + 1;
      });

      buttons.forEach(function (btn) {
        var badge = $("b", btn);
        if (badge) badge.textContent = String(counts[btn.dataset.filter] || 0);
        if ((counts[btn.dataset.filter] || 0) === 0 && btn.dataset.filter !== "all") {
          btn.disabled = true;
          btn.style.opacity = "0.45";
          btn.style.cursor = "default";
        }
      });

      buttons.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var cat = btn.dataset.filter;
          buttons.forEach(function (b) { b.classList.toggle("is-active", b === btn); });

          var shown = 0;
          items.forEach(function (item) {
            var match = cat === "all" || item.dataset.cat === cat;
            item.hidden = !match;
            if (match) shown += 1;
          });

          // hide timeline groups whose items are all hidden
          $$(".tl-group", scope).forEach(function (grp) {
            var kids = $$(".honor", grp);
            var any = kids.some(function (k) { return !k.hidden; });
            grp.hidden = !any;
          });

          if (emptyEl) emptyEl.hidden = shown !== 0;
        });
      });
    });
  }

  initFilters("[data-filter-group='honors']", ".honor", "#honorTimeline", $("#honorEmpty"));
  initFilters("[data-filter-group='certs']", ".cert", "#certGrid", $("#certEmpty"));

  /* ---------- Certificate lightbox ---------- */
  var lightbox = $("#lightbox");
  var lbImg = $("#lbImg");
  var lbCaption = $("#lbCaption");
  var lbCount = $("#lbCount");
  var lbPrev = $("#lbPrev");
  var lbNext = $("#lbNext");
  var lbClose = $("#lbClose");
  var lastFocused = null;
  var lbItems = [];
  var lbIndex = 0;

  function visibleCerts() {
    return $$(".cert").filter(function (el) { return !el.hidden; });
  }

  function render(index) {
    if (!lbItems.length) return;
    lbIndex = (index + lbItems.length) % lbItems.length;
    var fig = lbItems[lbIndex];
    var img = $("img", fig);
    var cap = $("figcaption", fig);
    if (img) {
      lbImg.src = img.currentSrc || img.src;
      lbImg.alt = img.alt || "";
    }
    if (lbCaption) lbCaption.textContent = cap ? cap.textContent.replace(/\s+/g, " ").trim() : "";
    if (lbCount) lbCount.textContent = (lbIndex + 1) + " / " + lbItems.length;
  }

  function openLightbox(fig) {
    if (!lightbox || !lbImg) return;
    lbItems = visibleCerts();
    var index = lbItems.indexOf(fig);
    lastFocused = document.activeElement;
    render(index < 0 ? 0 : index);
    lightbox.classList.add("open");
    document.body.style.overflow = "hidden";
    if (lbClose) lbClose.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove("open");
    document.body.style.overflow = "";
    lbImg.removeAttribute("src");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  $$(".cert").forEach(function (fig) {
    fig.addEventListener("click", function () { openLightbox(fig); });
    fig.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(fig);
      }
    });
  });

  if (lbPrev) lbPrev.addEventListener("click", function () { render(lbIndex - 1); });
  if (lbNext) lbNext.addEventListener("click", function () { render(lbIndex + 1); });
  if (lbClose) lbClose.addEventListener("click", closeLightbox);
  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (!lightbox || !lightbox.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") render(lbIndex - 1);
    if (e.key === "ArrowRight") render(lbIndex + 1);
  });

  /* ---------- Copy email + toast ---------- */
  var toast = $("#toast");
  var toastTimer = null;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove("is-visible"); }, 2200);
  }

  var copyBtn = $("#copyMail");
  if (copyBtn) {
    copyBtn.addEventListener("click", function () {
      var mail = copyBtn.dataset.mail || "";
      var done = function () {
        showToast("邮箱已复制：" + mail);
        var text = $("#copyMailText");
        if (text) {
          text.textContent = "已复制 ✓";
          window.setTimeout(function () { text.textContent = "一键复制到剪贴板"; }, 2200);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(mail).then(done).catch(function () { showToast("复制失败，请手动选择：" + mail); });
      } else {
        var tmp = document.createElement("textarea");
        tmp.value = mail;
        tmp.setAttribute("readonly", "");
        tmp.style.position = "fixed";
        tmp.style.opacity = "0";
        document.body.appendChild(tmp);
        tmp.select();
        try {
          document.execCommand("copy");
          done();
        } catch (err) {
          showToast("复制失败，请手动选择：" + mail);
        }
        document.body.removeChild(tmp);
      }
    });
  }

  /* ---------- Footer year ---------- */
  var yearEl = $("#year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
