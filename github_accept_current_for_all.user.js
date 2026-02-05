// ==UserScript==
// @name         GitHub conflicts: Accept current change for all
// @namespace    https://github.com/
// @version      1.0.0
// @description  Adds a one-click button on GitHub PR conflict pages to accept all "current" changes and mark files as resolved.
// @author       you
// @match        https://github.com/*/*/pull/*/conflicts
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_ID = 'tm-accept-current-for-all-btn';

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const isClickable = (el) => {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.getAttribute('aria-disabled') === 'true') return false;
    return true;
  };

  const byText = (regex) =>
    Array.from(document.querySelectorAll('button')).filter((btn) => regex.test(btn.textContent || ''));

  async function resolveAllConflicts() {
    let acceptedCount = 0;
    let resolvedCount = 0;

    for (let cycle = 0; cycle < 60; cycle += 1) {
      let hasAction = false;

      const acceptButtons = byText(/Accept\s+current\s+change/i).filter(isClickable);
      for (const btn of acceptButtons) {
        btn.click();
        acceptedCount += 1;
        hasAction = true;
        await sleep(50);
      }

      await sleep(200);

      const resolveButtons = byText(/Mark\s+as\s+resolved/i).filter(isClickable);
      for (const btn of resolveButtons) {
        btn.click();
        resolvedCount += 1;
        hasAction = true;
        await sleep(50);
      }

      if (!hasAction) break;
      await sleep(250);
    }

    return { acceptedCount, resolvedCount };
  }

  function addButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.textContent = 'Accept current change for all + resolve';

    Object.assign(btn.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '99999',
      padding: '10px 14px',
      borderRadius: '6px',
      border: '1px solid #1f6feb',
      background: '#238636',
      color: '#fff',
      fontWeight: '600',
      cursor: 'pointer',
      boxShadow: '0 4px 10px rgba(0,0,0,0.25)'
    });

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Processing...';

      try {
        const { acceptedCount, resolvedCount } = await resolveAllConflicts();
        btn.textContent = `Done: accepted ${acceptedCount}, resolved ${resolvedCount}`;
      } catch (err) {
        console.error('[TM] Failed to resolve all conflicts:', err);
        btn.textContent = 'Failed (see console)';
      }

      await sleep(2200);
      btn.textContent = originalText;
      btn.disabled = false;
    });

    document.body.appendChild(btn);
  }

  const init = () => {
    if (!/\/pull\/\d+\/conflicts/.test(location.pathname)) return;
    addButton();
  };

  init();

  const observer = new MutationObserver(() => {
    if (!document.getElementById(BUTTON_ID)) {
      init();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
