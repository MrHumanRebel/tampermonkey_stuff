// ==UserScript==
// @name         BunkerWeb UI Debloat
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Elrejti a GitHub/Discord/PRO/Stars/Plan/News elemeket a BunkerWeb UI-ból + PRO plugin sorokat
// @author       Mr_HumanRebel
// @match        http://192.168.0.197:7000/*
// @match        https://192.168.0.197:7000/*
// @icon         https://www.bunkerweb.io/wp-content/uploads/2023/06/cropped-bw-favicon-32x32.png
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  function removeSelector(selector) {
    document.querySelectorAll(selector).forEach((el) => el.remove());
  }

  // Stars LI célzottan (shadowrootmode=closed template alapján)
  function removeStarsLi() {
    document.querySelectorAll('li.nav-item').forEach((li) => {
      if (li.querySelector('template[shadowrootmode]')) {
        // Ez a GitHub Stars widget tartója
        li.remove();
      }
    });
  }

  // NAVBAR / GLOBAL BLOAT
  function removeNavBloat() {
    // GitHub / Discord gombok (navbar baloldali button group)
    removeSelector('.navbar .btn.btn-outline-github');
    removeSelector('.navbar .btn.btn-outline-discord');

    // Upgrade to PRO gomb (felül, diamond ikonos)
    removeSelector('.navbar .buy-now');

    // Stars li
    removeStarsLi();

    // Oldalsó menü PRO elem (/pro)
    document.querySelectorAll('a.menu-link[href="/pro"]').forEach((a) => {
      const li = a.closest('li.menu-item');
      if (li) li.remove();
      else a.remove();
    });
  }

  // HOME OLDAL BLOAT
  function removeHomeBloat() {
    // Plan FREE kártya
    document.querySelectorAll('span[data-i18n="plan.free"]').forEach((span) => {
      const col = span.closest('.col-md-3.mb-2') || span.closest('.col-md-3');
      if (col) col.remove();
    });

    // News card + zöld PRO banner – h5 data-i18n alapján
    document
      .querySelectorAll('h5[data-i18n="dashboard.card.news.title"]')
      .forEach((title) => {
        const col =
          title.closest('.col-md-5.mt-2.mb-2') ||
          title.closest('.col-md-5');
        if (col) col.remove();
      });

    // Extra biztonság: ha maradna banner/news container, azt is takarítsuk
    removeSelector('#banner-container');
    removeSelector('#data-news-container-home');
  }

  // PRO plugin kártyák (pl. Anti DDoS cardok máshol)
  function removeProPlugins() {
    document
      .querySelectorAll(
        'div.text-truncate.pe-2.text-primary.shine.shine-sm.ps-3'
      )
      .forEach((badge) => {
        const card =
          badge.closest('.card') ||
          badge.closest('.row') ||
          badge.closest('.col') ||
          badge.closest('.list-group-item');
        if (card) card.remove();
        else badge.remove();
      });
  }

  // 🔥 PRO sorok elrejtése a plugin/scheduler táblában (a screenshotod)
  function removeProSchedulerRows() {
    document.querySelectorAll('table tbody tr').forEach((tr) => {
      // TYPE oszlop – általában a 4. oszlop, de biztos ami biztos:
      // 1) keressük a tooltipet ("Pro feature")
      const hasProTooltip =
        tr.querySelector('[title*="Pro feature"]') ||
        tr.querySelector('[data-bs-original-title*="Pro feature"]');

      // 2) vagy a cella szövegében a "Pro" szót
      let typeText = '';
      const tds = Array.from(tr.querySelectorAll('td'));
      if (tds.length) {
        // ha stabilan 4. oszlop, ez pont az lesz; de ha nem, akkor is végigmegyünk alább
        const typeCell = tds[3] || null;
        if (typeCell) typeText = typeCell.textContent || '';
        if (!typeText) {
          typeText = tds.map((td) => td.textContent).join(' ').trim();
        }
      }

      const isProText = typeText.toLowerCase().includes('pro');

      if (hasProTooltip || isProText) {
        tr.remove();
      }
    });
  }

  function runDebloat() {
    removeNavBloat();
    removeHomeBloat();
    removeProPlugins();
    removeProSchedulerRows();
  }

  // Első futás
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runDebloat);
  } else {
    runDebloat();
  }

  // async betöltésre intervallumos rásegítés
  let tries = 0;
  const interval = setInterval(() => {
    runDebloat();
    tries++;
    if (tries >= 10) clearInterval(interval);
  }, 1000);

  // MutationObserver – ha a navbar / body változik, újra futtatjuk
  const observer = new MutationObserver(() => {
    runDebloat();
  });

  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
  });
})();
