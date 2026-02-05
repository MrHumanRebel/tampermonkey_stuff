// ==UserScript==
// @name         GitHub conflicts: Accept current change for all
// @namespace    https://github.com/
// @version      1.1.0
// @description  Adds a one-click button on GitHub PR conflict pages to accept all "current" changes and mark files as resolved.
// @author       you
// @match        https://github.com/*/*/pull/*/conflicts
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const BUTTON_ID = 'tm-accept-current-for-all-btn';
  const MAX_FILE_PASSES = 500;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();

  const isClickable = (el) => {
    if (!el || !el.isConnected) return false;

    const ariaDisabled = el.getAttribute('aria-disabled');
    if (ariaDisabled === 'true') return false;

    if ('disabled' in el && el.disabled) return false;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;

    return true;
  };

  function clickElement(el) {
    if (!isClickable(el)) return false;

    el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.click();

    return true;
  }

  function queryActionElements() {
    return Array.from(document.querySelectorAll('button, summary, [role="button"], .btn, .Button'));
  }

  function findByText(regex) {
    return queryActionElements().filter((el) => regex.test(normalizeText(el.textContent)));
  }

  function findAcceptCurrentButtons() {
    const regexes = [
      /accept current change/i,
      /use current/i,
      /choose current/i
    ];

    return queryActionElements().filter((el) => {
      const label = normalizeText(el.textContent);
      const aria = normalizeText(el.getAttribute('aria-label'));

      return regexes.some((regex) => regex.test(label) || regex.test(aria));
    });
  }

  async function acceptAllInCurrentFile() {
    let acceptedCount = 0;

    for (let cycle = 0; cycle < 120; cycle += 1) {
      const buttons = findAcceptCurrentButtons().filter(isClickable);
      if (!buttons.length) break;

      for (const btn of buttons) {
        if (clickElement(btn)) {
          acceptedCount += 1;
          await sleep(40);
        }
      }

      await sleep(140);
    }

    return acceptedCount;
  }

  async function markCurrentFileResolved() {
    await sleep(120);

    const resolveButtons = findByText(/mark as resolved/i).filter(isClickable);
    for (const btn of resolveButtons) {
      if (clickElement(btn)) {
        await sleep(200);
        return true;
      }
    }

    return false;
  }

  async function goToNextFile() {
    await sleep(120);

    const nextButtons = findByText(/^next$/i).filter(isClickable);
    for (const btn of nextButtons) {
      if (clickElement(btn)) {
        await sleep(260);
        return true;
      }
    }

    return false;
  }

  async function resolveAllConflictsInAllFiles() {
    let acceptedCount = 0;
    let resolvedCount = 0;

    for (let filePass = 0; filePass < MAX_FILE_PASSES; filePass += 1) {
      const acceptedNow = await acceptAllInCurrentFile();
      acceptedCount += acceptedNow;

      const resolvedNow = await markCurrentFileResolved();
      if (resolvedNow) {
        resolvedCount += 1;
      }

      const moved = await goToNextFile();
      if (!moved) break;
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
        const { acceptedCount, resolvedCount } = await resolveAllConflictsInAllFiles();
        btn.textContent = `Done: accepted ${acceptedCount}, resolved files ${resolvedCount}`;
      } catch (err) {
        console.error('[TM] Failed to resolve all conflicts:', err);
        btn.textContent = 'Failed (see console)';
      }

      await sleep(2600);
      btn.textContent = originalText;
      btn.disabled = false;
    });

    document.body.appendChild(btn);
  }

  function init() {
    if (!/\/pull\/\d+\/conflicts/.test(location.pathname)) return;
    addButton();
  }

  init();

  const observer = new MutationObserver(() => {
    if (!document.getElementById(BUTTON_ID)) {
      init();
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
