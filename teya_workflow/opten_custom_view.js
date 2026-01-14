// ==UserScript==
// @name         Opten – Teya Onboarding menüpont (Riport fölé, no default redirect)
// @namespace    https://teya.local/
// @version      1.0.0
// @description  "Teya Onboarding" menüpont beszúrása a bal oldali menübe a Riport fölé, default navigáció nélkül. Modál + copy (tax, cjsz, cím, cégnév, eid).
// @author       You
// @match        https://www.opten.hu/*
// @match        https://opten.hu/*
// @run-at       document-idle
// @grant        GM_setClipboard
// ==/UserScript==

(() => {
  "use strict";

  // -------------------------
  // CONFIG (opcionális)
  // -------------------------
  // Ha van konkrét Teya onboarding URL-ed, ide beírhatod.
  // Példa: const TEYA_ONBOARDING_BASE_URL = "https://your-teya-onboarding-url/form";
  // A script query paramként hozzáadja: companyName, taxId, registryNumber, address, eid, sourceUrl
  const TEYA_ONBOARDING_BASE_URL = "";

  const MENU_ANCHOR_ID = "aujcegriport";          // Riport link id (e fölé szúrunk)
  const INSERTED_LI_ID = "teya-onboarding-li";    // saját elem azonosítója
  const INSERTED_A_ID  = "teya-onboarding-link";

  // A cégadatok tipikus DOM id-k (a feltöltött HTML alapján)
  const SELECTORS = {
    companyName: "#parsedNameTitle", // sok nézetben ez létezik
    taxId: "#asz_l_txt_1",
    registryNumber: "#cjsz_txt_2",
    address: "#asz_txt_0",
  };

  // -------------------------
  // Helpers
  // -------------------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function textFrom(selector) {
    const el = document.querySelector(selector);
    if (!el) return "";
    return (el.textContent || "").trim();
  }

  function getEidFromUrl() {
    const m = window.location.pathname.match(/eid(\d+)/i);
    return m ? `eid${m[1]}` : "";
  }

  function buildPayload() {
    // Cégnév fallback: ha nincs parsedNameTitle, próbáljuk meg title/h1 alapján
    const name =
      textFrom(SELECTORS.companyName) ||
      (document.querySelector("h1")?.textContent || "").trim() ||
      (document.title || "").trim();

    const payload = {
      companyName: name || "",
      taxId: textFrom(SELECTORS.taxId),
      registryNumber: textFrom(SELECTORS.registryNumber),
      address: textFrom(SELECTORS.address),
      eid: getEidFromUrl(),
      sourceUrl: window.location.href
    };

    return payload;
  }

  function safeCopy(text) {
    try {
      if (typeof GM_setClipboard === "function") {
        GM_setClipboard(text, "text");
        return true;
      }
    } catch (_) {}
    // fallback
    try {
      navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
    return false;
  }

  function ensureModal() {
    if (document.getElementById("teyaOnboardingModal")) return;

    const modalHtml = `
<div class="modal fade" id="teyaOnboardingModal" tabindex="-1" aria-labelledby="teyaOnboardingModalLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-scrollable">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="teyaOnboardingModalLabel">Teya Onboarding</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Bezárás"></button>
      </div>
      <div class="modal-body">
        <div class="alert alert-secondary py-2">
          <div class="small mb-1"><b>Forrás:</b> Opten nézetből kiolvasott adatok</div>
          <div class="small"><b>Megjegyzés:</b> ez a menüpont nem navigál el automatikusan sehova (nincs “default riport” betöltés).</div>
        </div>

        <div class="row g-3">
          <div class="col-12">
            <label class="form-label">Cégnév</label>
            <input class="form-control" id="teya_companyName" placeholder="ISMERETLEN" />
          </div>

          <div class="col-md-6">
            <label class="form-label">Adószám</label>
            <input class="form-control" id="teya_taxId" placeholder="ISMERETLEN" />
          </div>

          <div class="col-md-6">
            <label class="form-label">Cégjegyzékszám</label>
            <input class="form-control" id="teya_registryNumber" placeholder="ISMERETLEN" />
          </div>

          <div class="col-12">
            <label class="form-label">Cím</label>
            <input class="form-control" id="teya_address" placeholder="ISMERETLEN" />
          </div>

          <div class="col-md-6">
            <label class="form-label">EID</label>
            <input class="form-control" id="teya_eid" placeholder="eid..." />
          </div>

          <div class="col-md-6">
            <label class="form-label">Forrás URL</label>
            <input class="form-control" id="teya_sourceUrl" />
          </div>
        </div>

        <hr class="my-4"/>

        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-primary" id="teya_copy_json">Copy JSON</button>
          <button class="btn btn-outline-primary" id="teya_copy_block">Copy onboarding blokk</button>
          <button class="btn btn-outline-secondary" id="teya_open_teya" ${TEYA_ONBOARDING_BASE_URL ? "" : "disabled"}>Megnyitás Teya Onboardingban</button>
        </div>

        <div class="mt-3 small text-muted" id="teya_copy_status" style="min-height: 18px;"></div>
      </div>
    </div>
  </div>
</div>`.trim();

    document.body.insertAdjacentHTML("beforeend", modalHtml);

    // Wire buttons
    document.getElementById("teya_copy_json").addEventListener("click", () => {
      const p = readModalFields();
      const ok = safeCopy(JSON.stringify(p, null, 2));
      setStatus(ok ? "JSON másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_copy_block").addEventListener("click", () => {
      const p = readModalFields();
      const block =
`Cégnév: ${p.companyName || "ISMERETLEN"}
Adószám: ${p.taxId || "ISMERETLEN"}
Cégjegyzékszám: ${p.registryNumber || "ISMERETLEN"}
Cím: ${p.address || "ISMERETLEN"}
EID: ${p.eid || "ISMERETLEN"}
Forrás: ${p.sourceUrl || ""}`.trim();

      const ok = safeCopy(block);
      setStatus(ok ? "Onboarding blokk másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_open_teya").addEventListener("click", () => {
      if (!TEYA_ONBOARDING_BASE_URL) return;
      const p = readModalFields();
      const url = new URL(TEYA_ONBOARDING_BASE_URL);
      url.searchParams.set("companyName", p.companyName || "");
      url.searchParams.set("taxId", p.taxId || "");
      url.searchParams.set("registryNumber", p.registryNumber || "");
      url.searchParams.set("address", p.address || "");
      url.searchParams.set("eid", p.eid || "");
      url.searchParams.set("sourceUrl", p.sourceUrl || "");
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    });

    function setStatus(msg) {
      const el = document.getElementById("teya_copy_status");
      if (!el) return;
      el.textContent = msg;
      setTimeout(() => { el.textContent = ""; }, 2500);
    }

    function readModalFields() {
      return {
        companyName: document.getElementById("teya_companyName")?.value?.trim() || "",
        taxId: document.getElementById("teya_taxId")?.value?.trim() || "",
        registryNumber: document.getElementById("teya_registryNumber")?.value?.trim() || "",
        address: document.getElementById("teya_address")?.value?.trim() || "",
        eid: document.getElementById("teya_eid")?.value?.trim() || "",
        sourceUrl: document.getElementById("teya_sourceUrl")?.value?.trim() || ""
      };
    }
  }

  function fillModalFromPage() {
    const p = buildPayload();
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v || "";
    };
    setVal("teya_companyName", p.companyName);
    setVal("teya_taxId", p.taxId);
    setVal("teya_registryNumber", p.registryNumber);
    setVal("teya_address", p.address);
    setVal("teya_eid", p.eid);
    setVal("teya_sourceUrl", p.sourceUrl);
  }

  function openModal() {
    ensureModal();
    fillModalFromPage();

    // Bootstrap modal (a HTML-ben bootstrap.bundle szerepel, így jó eséllyel elérhető):contentReference[oaicite:3]{index=3}
    const modalEl = document.getElementById("teyaOnboardingModal");
    if (window.bootstrap?.Modal) {
      const m = window.bootstrap.Modal.getOrCreateInstance(modalEl);
      m.show();
      return;
    }

    // Fallback, ha nincs bootstrap namespace
    modalEl.classList.add("show");
    modalEl.style.display = "block";
    modalEl.removeAttribute("aria-hidden");
  }

  function insertMenuItem() {
    // már beszúrtuk?
    if (document.getElementById(INSERTED_LI_ID)) return;

    const reportLink = document.getElementById(MENU_ANCHOR_ID);
    if (!reportLink) return;

    const ul = reportLink.closest("ul.sidebar-menu-group");
    if (!ul) return;

    const reportLi = reportLink.closest("li.list-group-item");
    if (!reportLi) return;

    const li = document.createElement("li");
    li.className = "list-group-item";
    li.id = INSERTED_LI_ID;

    // Ikon: használunk egy meglévő fontawesome ikont, hogy biztosan megjelenjen
    // (Az oldalon több FA icon is van, pl. fa-file-lines stb.:contentReference[oaicite:4]{index=4})
    li.innerHTML = `
      <a id="${INSERTED_A_ID}" class="w-100 d-flex align-items-center" href="#" title="Teya Onboarding">
        <i class="fa-regular fa-square-check"></i>
        <label class="ms-2">Teya Onboarding</label>
      </a>
    `.trim();

    // beszúrás Riport elé
    ul.insertBefore(li, reportLi);

    // click handler (nem navigál)
    const a = li.querySelector("a");
    a.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModal();
    });
  }

  async function boot() {
    // FONTOS: NINCS default redirect / NINCS auto-click.
    // Csak beszúrjuk a menüt, amikor a DOM készen van, és később is figyeljük a változásokat.

    // első próbálkozás
    insertMenuItem();

    // SPA / React / partial reload esetére: figyeljük a sidebar-t
    const sidebarRoot =
      document.getElementById("sidebar-menu-blocks") ||
      document.querySelector(".sidebar-menu-blocks") ||
      document.body;

    const mo = new MutationObserver(() => insertMenuItem());
    mo.observe(sidebarRoot, { childList: true, subtree: true });

    // biztos ami biztos: pár késleltetett retry (ha nagyon későn épül a menü)
    for (let i = 0; i < 10; i++) {
      if (document.getElementById(INSERTED_LI_ID)) break;
      insertMenuItem();
      await sleep(400);
    }
  }

  boot();
})();
