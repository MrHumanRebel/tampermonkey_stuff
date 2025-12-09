// ==UserScript==
// @name         ChatGPT Full-Page + Single-Message PDF Export Helper
// @namespace    http://tampermonkey.net/
// @version      2.2
// @description  Teljes oldal vagy egy konkrét üzenet nyomtatása/PDF-be mentése a chatgpt.com-on, layout szétcseszése nélkül.
// @author       Mr_HumanRebel
// @match        https://chatgpt.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ---------------- CSS: PRINT + GOMBOK ----------------
    var customStyles = `
@media print {

  /* Ne legyen 1 képernyőre fixálva az oldal */
  html, body {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  /* Biztonság kedvéért: ne legyenek transformok */
  body * {
    transform: none !important;
  }

  /* Eredeti font + wrap fixek */
  :not(.katex):not(.katex *) {
    font-family: Arial, sans-serif !important;
  }

  :not(.katex) code:not(.katex *),
  :not(.katex) span:not(.katex *) {
    font-family: Menlo, monospace !important;
    white-space: pre-wrap !important;
    overflow-wrap: break-word !important;
  }

  /* Scrollos konténerek “kiterítése” */
  :not(.katex) .overflow-auto:not(.katex *),
  :not(.katex *) .overflow-auto,
  :not(.katex) .overflow-y-auto:not(.katex *),
  :not(.katex *) .overflow-y-auto,
  :not(.katex) .overflow-x-auto:not(.katex *),
  :not(.katex *) .overflow-x-auto {
    overflow: visible !important;
    max-height: none !important;
  }

  :not(.katex) .h-full:not(.katex *),
  :not(.katex *) .h-full,
  :not(.katex) .max-h-screen:not(.katex *),
  :not(.katex *) .max-h-screen,
  :not(.katex) .max-h-full:not(.katex *),
  :not(.katex *) .max-h-full {
    height: auto !important;
    max-height: none !important;
  }

  main,
  [class*="scroll"],
  [class*="Scroll"],
  [class*="overflow"] {
    height: auto !important;
    max-height: none !important;
    overflow: visible !important;
  }

  [class*="h-screen"],
  [class*="min-h-screen"],
  [class*="max-h-screen"] {
    height: auto !important;
    min-height: auto !important;
    max-height: none !important;
  }

  :not(.katex) #text:not(.katex *),
  :not(.katex *) #text {
    white-space: pre-wrap !important;
  }

  /* ---- CSAK EGY ÜZENET NYOMTATÁSA MÓD ---- */

  /* Csak a print-konténer maradjon látható */
  body.gpt-print-single .gpt-hide-print-me {
    display: none !important;
  }

  body.gpt-print-single #gpt-print-container {
    display: block !important;
    margin: 0 auto !important;
    max-width: 900px !important;
  }

  body.gpt-print-single {
    background: #ffffff !important;
  }

  body.gpt-print-single #gpt-print-container,
  body.gpt-print-single #gpt-print-container * {
    color: #000000 !important;
    background-color: transparent !important;
  }

  /* Single-print módban a különféle action gombok ne látszódjanak */
  body.gpt-print-single [data-testid$="turn-action-button"],
  body.gpt-print-single button[aria-label="More actions"],
  body.gpt-print-single button[aria-label="Switch model"],
  body.gpt-print-single .gpt-pdf-btn {
    display: none !important;
  }

  /* Full page PDF gomb se látszódjon a PDF-ben */
  .gpt-fullpage-pdf-btn {
    display: none !important;
  }

  /* Globálisan rejtsük a Copy code / Share / Copy turn gombokat printnél */
  .gpt-hide-print-button-copycode,
  button[aria-label="Share"],
  [data-testid="share-turn-action-button"],
  [data-testid="share-chat-button"],
  [data-testid="copy-turn-action-button"] {
    display: none !important;
  }
}

/* ---- PER-ÜZENET "PDF" GOMB STÍLUS ---- */

.gpt-pdf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  cursor: pointer;
  opacity: 0.7;
  backdrop-filter: blur(6px);
  white-space: nowrap;
}

.gpt-pdf-btn:hover {
  opacity: 1;
}
`;

    function injectStyles() {
        var styleSheet = document.createElement('style');
        styleSheet.type = 'text/css';
        styleSheet.textContent = customStyles;
        document.documentElement.appendChild(styleSheet);
    }

    if (document.head) {
        injectStyles();
    } else {
        new MutationObserver(function (mutations, observer) {
            if (document.head) {
                injectStyles();
                observer.disconnect();
            }
        }).observe(document.documentElement, { childList: true, subtree: true });
    }

    // ---- SINGLE-MESSAGE PRINT LOGIKA ----

    function printSingleMessage(messageEl) {
        if (!messageEl) return;
        var body = document.body;
        if (!body) return;

        // ha maradt volna régi wrapper, takarítsuk el
        var oldWrapper = document.getElementById('gpt-print-container');
        if (oldWrapper) {
            oldWrapper.remove();
        }

        // az egész "turn" klónozása (hogy a layout maradjon)
        var turnRoot = messageEl.closest('.agent-turn') || messageEl;
        var clone = turnRoot.cloneNode(true);

        var wrapper = document.createElement('div');
        wrapper.id = 'gpt-print-container';
        wrapper.appendChild(clone);

        // body gyerekek megjelölése, hogy printnél eltűnjenek
        var bodyChildren = Array.from(body.children);
        bodyChildren.forEach(function (el) {
            el.classList.add('gpt-hide-print-me');
        });

        // wrapper hozzáadása (erre NEM rakunk gpt-hide-print-me-t)
        body.appendChild(wrapper);
        wrapper.classList.remove('gpt-hide-print-me');

        body.classList.add('gpt-print-single');

        window.print();

        // cleanup
        body.classList.remove('gpt-print-single');
        wrapper.remove();
        bodyChildren.forEach(function (el) {
            el.classList.remove('gpt-hide-print-me');
        });
    }

    // ---- HELPER: Copy code gombok megjelölése ----

    function tagUtilityButtons(root) {
        if (!root || !root.querySelectorAll) return;
        var buttons = root.querySelectorAll('button');
        buttons.forEach(function (btn) {
            var txt = (btn.textContent || '').trim();
            if (!txt) return;
            // "Copy code" gombok printnél eltüntetésre jelölése
            if (/^copy code$/i.test(txt)) {
                btn.classList.add('gpt-hide-print-button-copycode');
            }
        });
    }

    // ---- FEJLÉC: FULL PAGE PDF GOMB ----

    function addFullPagePdfButton() {
        // ha már van, ne rakjuk újra
        if (document.querySelector('.gpt-fullpage-pdf-btn')) return;

        // Share gomb keresése a headerben
        var shareBtn = document.querySelector(
            'header#page-header button[data-testid="share-chat-button"]'
        );
        if (!shareBtn) return;

        var fullBtn = document.createElement('button');
        fullBtn.type = 'button';
        fullBtn.className = shareBtn.className + ' gpt-fullpage-pdf-btn';
        fullBtn.setAttribute('aria-label', 'Full page PDF');

        fullBtn.innerHTML =
            '<div class="flex w-full items-center justify-center gap-1.5">' +
            '<span class="-ms-0.5 icon">📄</span>' +
            '<span>Full page PDF</span>' +
            '</div>';

        fullBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            // teljes oldal nyomtatása
            window.print();
        });

        // Share gomb MELLÉ tesszük
        shareBtn.insertAdjacentElement('afterend', fullBtn);
    }

    // ---- PER-ÜZENET PDF GOMBOK (assistant only) ----

    function addPdfButtonToMessage(messageEl) {
        if (!(messageEl instanceof HTMLElement)) return;

        // Csak assistant üzenetekre
        if (messageEl.getAttribute('data-message-author-role') !== 'assistant') return;

        // Ne duplikáljunk
        if (messageEl.dataset.gptPdfAttached === '1') return;
        messageEl.dataset.gptPdfAttached = '1';

        var turnRoot =
            messageEl.closest('.agent-turn') ||
            messageEl.parentElement ||
            messageEl;

        var moreBtn = turnRoot.querySelector('button[aria-label="More actions"]');
        if (!moreBtn) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = 'PDF';
        btn.className = 'gpt-pdf-btn';

        btn.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            printSingleMessage(messageEl);
        });

        moreBtn.insertAdjacentElement('afterend', btn);
    }

    function processExistingMessages() {
        var messages = document.querySelectorAll('div[data-message-author-role="assistant"]');
        messages.forEach(addPdfButtonToMessage);
        tagUtilityButtons(document);
    }

    function startObservers() {
        processExistingMessages();
        addFullPagePdfButton();

        var observer = new MutationObserver(function (mutations) {
            for (var mutation of mutations) {
                mutation.addedNodes.forEach(function (node) {
                    if (!(node instanceof HTMLElement)) return;

                    if (node.matches && node.matches('div[data-message-author-role="assistant"]')) {
                        addPdfButtonToMessage(node);
                        tagUtilityButtons(node);
                    } else if (node.querySelectorAll) {
                        node
                            .querySelectorAll('div[data-message-author-role="assistant"]')
                            .forEach(addPdfButtonToMessage);
                        tagUtilityButtons(node);
                    }
                });
            }
            // ha a header újra-renderelődik (chat váltás), újra próbáljuk a gombot
            addFullPagePdfButton();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    function waitForBodyAndStart() {
        if (document.body) {
            startObservers();
            return;
        }

        new MutationObserver(function (mutations, observer) {
            if (document.body) {
                observer.disconnect();
                startObservers();
            }
        }).observe(document.documentElement, { childList: true, subtree: true });
    }

    waitForBodyAndStart();
})();
