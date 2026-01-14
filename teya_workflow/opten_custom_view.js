// ==UserScript==
// @name         Opten – Teya Onboarding menüpont (Riport fölé, no default redirect)
// @namespace    https://teya.local/
// @version      1.1.0
// @description  "Teya Onboarding" menüpont beszúrása a bal oldali menübe a Riport fölé, default navigáció nélkül. Oldalsó drawer + mezőnkénti copy, onboardinghoz szükséges adatokkal.
// @author       You
// @match        https://www.opten.hu/*
// @match        https://opten.hu/*
// @run-at       document-idle
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      iban.hu
// @connect      www.iban.hu
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

  const SELECTORS = {
    companyName: "#parsedNameTitle",
    taxId: "#asz_l_txt_1",
    registryNumber: "#cjsz_txt_2",
    address: "#asz_txt_0"
  };

  const DRAWER_IDS = {
    backdrop: "teya-onb-backdrop",
    drawer: "teya-onb-drawer",
    body: "teya-onb-body",
    title: "teya-onb-title",
    sub: "teya-onb-sub",
    toast: "teya-onb-toast"
  };

  let cachedDataKey = "";
  let cachedDataPromise = null;
  let cachedData = null;
  let currentData = null;

  // -------------------------
  // Helpers
  // -------------------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function textFrom(root, selector) {
    const el = root.querySelector(selector);
    if (!el) return "";
    return (el.textContent || "").trim();
  }

  function normalizeSpace(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function textFromLabel(root, labelText) {
    const labels = Array.from(root.querySelectorAll(".data-line--label"));
    const match = labels.find((label) =>
      normalizeSpace(label.textContent || "").toLowerCase().includes(labelText.toLowerCase())
    );
    const value = match?.parentElement?.querySelector(".data-line--content");
    return normalizeSpace(value?.textContent || "");
  }

  function textFromTitle(root, titleText) {
    const titles = Array.from(root.querySelectorAll(".data-title"));
    const match = titles.find((title) =>
      normalizeSpace(title.textContent || "").toLowerCase().includes(titleText.toLowerCase())
    );
    if (!match) return "";
    const row = match.closest(".row") || match.parentElement;
    const value = row?.querySelector(".data-value");
    return normalizeSpace(value?.textContent || "");
  }

  function getEidFromUrl() {
    const m = window.location.pathname.match(/eid(\d+)/i);
    return m ? `eid${m[1]}` : "";
  }

  function getEidFromDoc(root) {
    const canonical = root.querySelector("link[rel='canonical']")?.href || "";
    const match = canonical.match(/eid\d+/i);
    return match ? match[0] : "";
  }

  function buildPayload(root = document) {
    const name =
      textFrom(root, SELECTORS.companyName) ||
      normalizeSpace(root.querySelector("#subhead-2 .head-title h3")?.textContent) ||
      normalizeSpace(root.querySelector("h1")?.textContent) ||
      normalizeSpace(root.title || document.title);

    const taxId =
      textFrom(root, SELECTORS.taxId) ||
      normalizeSpace(root.querySelector("#subhead-21 h3")?.textContent) ||
      textFromLabel(root, "Adószám");

    return {
      companyName: name || "",
      taxId,
      registryNumber: textFrom(root, SELECTORS.registryNumber) || textFromLabel(root, "Cégjegyzékszám"),
      address: textFrom(root, SELECTORS.address) || normalizeSpace(root.querySelector("#subhead-5 .head-title a")?.textContent),
      eid: getEidFromUrl(),
      sourceUrl: window.location.href
    };
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

  function ensureDrawer() {
    if (document.getElementById(DRAWER_IDS.drawer)) return;

    const style = document.createElement("style");
    style.textContent = `
      :root { --teya-z: 999999; }
      .teya-onb-backdrop{
        position: fixed; inset: 0;
        background: rgba(0,0,0,.35);
        z-index: var(--teya-z);
        display:none;
      }
      .teya-onb-backdrop.show{ display:block; }
      .teya-onb-drawer{
        position: fixed; top: 0; right: 0; height: 100vh; width: min(840px, 96vw);
        background: #fff;
        box-shadow: -16px 0 40px rgba(0,0,0,.22);
        z-index: calc(var(--teya-z) + 1);
        transform: translateX(100%);
        transition: transform .18s ease-out;
        display:flex; flex-direction:column;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      }
      .teya-onb-drawer.show{ transform: translateX(0); }
      .teya-onb-header{
        display:flex; align-items:flex-start; justify-content:space-between;
        gap: 12px; padding: 14px 16px;
        border-bottom: 1px solid #e7e7e7;
      }
      .teya-onb-title{
        display:flex; flex-direction:column; gap: 6px; min-width: 0;
      }
      .teya-onb-title h2{
        margin: 0; font-size: 16px; font-weight: 700;
        letter-spacing: .2px; color:#111; white-space:nowrap;
        overflow:hidden; text-overflow:ellipsis;
      }
      .teya-onb-sub{
        font-size: 12px; color:#555; display:flex; flex-wrap:wrap; gap: 10px;
      }
      .teya-onb-close{
        border: 1px solid #ddd; background: #fff;
        border-radius: 10px; width: 36px; height: 36px;
        cursor:pointer; display:flex; align-items:center; justify-content:center;
        flex: 0 0 auto;
      }
      .teya-onb-close:hover{ background:#f6f6f6; }
      .teya-onb-body{
        padding: 14px 16px 24px; overflow:auto;
      }
      .teya-section{
        border: 1px solid #eee; border-radius: 12px; margin-bottom: 16px;
        overflow:hidden; background: #fff;
      }
      .teya-section-head{
        display:flex; justify-content:space-between; align-items:center;
        padding: 10px 12px; background:#fafafa; border-bottom:1px solid #eee;
        font-weight:600; font-size:13px;
      }
      .teya-row{
        display:grid; grid-template-columns: 190px 1fr 44px;
        gap: 10px; padding: 10px 12px; align-items:center;
        border-bottom: 1px solid #f0f0f0;
      }
      .teya-row:last-child{ border-bottom: none; }
      .teya-label{ font-size: 12px; color:#333; }
      .teya-value{
        width: 100%; border:1px solid #e2e2e2; border-radius: 8px;
        padding: 8px 10px; font-size: 13px; color:#111; background:#fff;
      }
      .teya-value[readonly]{ background:#fafafa; }
      .teya-copy{
        border: 1px solid #ddd; background: #fff; border-radius: 10px;
        width: 36px; height: 36px; cursor:pointer; display:flex;
        align-items:center; justify-content:center;
      }
      .teya-copy:hover{ background:#f6f6f6; }
      .teya-toolbar{
        display:flex; flex-wrap:wrap; gap: 8px; margin-top: 4px;
      }
      .teya-btn{
        border-radius: 10px; padding: 8px 12px; border:1px solid #d6d6d6;
        background:#fff; cursor:pointer; font-size: 13px;
      }
      .teya-btn.primary{ background:#0d6efd; color:#fff; border-color:#0d6efd; }
      .teya-toast{
        position: fixed; right: 20px; bottom: 18px; background: #111; color:#fff;
        padding: 10px 14px; border-radius: 10px; font-size: 12px;
        opacity: 0; transform: translateY(8px);
        transition: opacity .2s ease, transform .2s ease;
        z-index: calc(var(--teya-z) + 2);
      }
      .teya-toast.show{ opacity: 1; transform: translateY(0); }
      @media (max-width: 720px){
        .teya-row{ grid-template-columns: 1fr 44px; }
        .teya-label{ grid-column: 1 / -1; padding-top:0; }
      }
    `.trim();

    const backdrop = document.createElement("div");
    backdrop.id = DRAWER_IDS.backdrop;
    backdrop.className = "teya-onb-backdrop";

    const drawer = document.createElement("aside");
    drawer.id = DRAWER_IDS.drawer;
    drawer.className = "teya-onb-drawer";
    drawer.innerHTML = `
      <div class="teya-onb-header">
        <div class="teya-onb-title">
          <h2 id="${DRAWER_IDS.title}">Teya Onboarding</h2>
          <div class="teya-onb-sub" id="${DRAWER_IDS.sub}"></div>
          <div class="teya-toolbar">
            <button class="teya-btn primary" id="teya_copy_json">Copy JSON</button>
            <button class="teya-btn" id="teya_copy_block">Copy onboarding blokk</button>
            <button class="teya-btn" id="teya_open_teya" ${TEYA_ONBOARDING_BASE_URL ? "" : "disabled"}>Megnyitás Teya Onboardingban</button>
          </div>
        </div>
        <button class="teya-onb-close" id="teya-onb-close" title="Bezárás (Esc)">
          <span style="font-size:18px; line-height:18px;">×</span>
        </button>
      </div>
      <div class="teya-onb-body" id="${DRAWER_IDS.body}"></div>
    `.trim();

    const toast = document.createElement("div");
    toast.id = DRAWER_IDS.toast;
    toast.className = "teya-toast";

    document.head.appendChild(style);
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    document.body.appendChild(toast);

    document.getElementById("teya-onb-close").addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDrawer();
    });

    drawer.addEventListener("click", (event) => {
      const button = event.target.closest(".teya-copy");
      if (!button) return;
      const row = button.closest(".teya-row");
      const input = row?.querySelector(".teya-value");
      if (!input) return;
      const ok = safeCopy(input.value || "");
      showToast(ok ? "Másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_copy_json").addEventListener("click", async () => {
      const payload = await collectPayload();
      const ok = safeCopy(JSON.stringify(payload, null, 2));
      showToast(ok ? "JSON másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_copy_block").addEventListener("click", async () => {
      const payload = await collectPayload();
      const lines = Object.entries(payload)
        .filter(([, value]) => value !== "")
        .map(([key, value]) => `${key}: ${value}`);
      const ok = safeCopy(lines.join("\n"));
      showToast(ok ? "Onboarding blokk másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_open_teya").addEventListener("click", async () => {
      if (!TEYA_ONBOARDING_BASE_URL) return;
      const payload = await collectPayload();
      const url = new URL(TEYA_ONBOARDING_BASE_URL);
      Object.entries(payload).forEach(([key, value]) => {
        url.searchParams.set(key, value || "");
      });
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    });
  }

  function showToast(message) {
    const toast = document.getElementById(DRAWER_IDS.toast);
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2000);
  }

  function closeDrawer() {
    document.getElementById(DRAWER_IDS.drawer)?.classList.remove("show");
    document.getElementById(DRAWER_IDS.backdrop)?.classList.remove("show");
  }

  function openDrawer() {
    ensureDrawer();
    renderLoading();
    document.getElementById(DRAWER_IDS.drawer)?.classList.add("show");
    document.getElementById(DRAWER_IDS.backdrop)?.classList.add("show");
    loadDataAndRender();
  }

  function renderLoading() {
    const body = document.getElementById(DRAWER_IDS.body);
    if (!body) return;
    body.innerHTML = `
      <div class="teya-section">
        <div class="teya-section-head">Betöltés</div>
        <div class="teya-row">
          <div class="teya-label">Állapot</div>
          <input class="teya-value" type="text" readonly value="Adatok betöltése folyamatban..." />
          <button class="teya-copy" title="Másolás" disabled>…</button>
        </div>
      </div>
    `.trim();
  }

  async function loadDataAndRender() {
    const data = await getAllData();
    currentData = data;
    renderDrawer(data);
  }

  function getCacheKey() {
    const doc = document;
    return getEidFromUrl() || getEidFromDoc(doc) || normalizeRegistryNumber(readRegistryNumberFromDoc(doc));
  }

  async function getAllData() {
    const key = getCacheKey();
    if (cachedData && cachedDataKey === key) return cachedData;
    if (cachedDataPromise && cachedDataKey === key) return cachedDataPromise;
    cachedDataKey = key;
    cachedDataPromise = loadAllData().then((data) => {
      cachedData = data;
      return data;
    });
    return cachedDataPromise;
  }

  function buildRow(label, value, { multiline = false, id } = {}) {
    const row = document.createElement("div");
    row.className = "teya-row";

    const labelEl = document.createElement("div");
    labelEl.className = "teya-label";
    labelEl.textContent = label;

    const input = multiline ? document.createElement("textarea") : document.createElement("input");
    input.className = "teya-value";
    input.readOnly = true;
    input.value = value || "";
    if (multiline) {
      input.rows = Math.min(8, Math.max(3, input.value.split("\n").length));
    } else {
      input.type = "text";
    }
    if (id) input.id = id;

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "teya-copy";
    copyBtn.title = "Másolás";
    copyBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 18H8V7h11v16z"></path>
      </svg>
    `.trim();

    row.appendChild(labelEl);
    row.appendChild(input);
    row.appendChild(copyBtn);
    return row;
  }

  function buildSection(title, rows) {
    const section = document.createElement("div");
    section.className = "teya-section";
    const header = document.createElement("div");
    header.className = "teya-section-head";
    header.textContent = title;
    section.appendChild(header);
    rows.forEach((row) => section.appendChild(row));
    return section;
  }

  function readAuthorizedSignatories(root) {
    const items = Array.from(root.querySelectorAll("#subhead-13 .oi-list-item"));
    if (!items.length) return [];
    const findLabelValue = (root, labelText) => {
      const labels = Array.from(root.querySelectorAll(".data-line--label"));
      const match = labels.find((label) =>
        normalizeSpace(label.textContent || "").toLowerCase().includes(labelText.toLowerCase())
      );
      return normalizeSpace(match?.parentElement?.querySelector(".data-line--content")?.textContent || "");
    };
    return items.map((item) => {
      const head = item.querySelector(".head-title");
      const anchors = head ? Array.from(head.querySelectorAll("a")) : [];
      const name = normalizeSpace(anchors[0]?.textContent || "");
      const role = normalizeSpace(head?.querySelector("span.text-opten-blue")?.textContent || "");
      const address = normalizeSpace(anchors[1]?.textContent || "");
      const birth = findLabelValue(item, "Születés ideje");
      const taxId = findLabelValue(item, "Adóazonosító");
      const representation = Array.from(item.querySelectorAll(".data-line--content"))
        .map((el) => normalizeSpace(el.textContent))
        .find((value) => value.toLowerCase().startsWith("a képviselet módja")) || "";
      const hatalyos = normalizeSpace(
        findLabelValue(item, "Hatályos")
      );
      return {
        name: name || "ISMERETLEN",
        role: role || "ISMERETLEN",
        address: address || "ISMERETLEN",
        birth: birth || "ISMERETLEN",
        taxId: taxId || "ISMERETLEN",
        representation: representation || "ISMERETLEN",
        hatalyos: hatalyos || "ISMERETLEN"
      };
    });
  }

  function readTelephelyek(root) {
    const nodes = Array.from(root.querySelectorAll("#subhead-6 .head-title a"));
    return nodes.map((node) => normalizeSpace(node.textContent)).filter(Boolean);
  }

  function readTevekenysegek(root) {
    const list = Array.from(root.querySelectorAll("#subhead-9 .title-text"))
      .map((el) => normalizeSpace(el.textContent))
      .filter(Boolean);
    if (list.length) return list;
    const fallback = textFromTitle(root, "Főtevékenysége");
    return fallback ? [fallback] : [];
  }

  function readEmails(root) {
    const emails = Array.from(root.querySelectorAll("#subhead-90 a[href^='mailto:']"))
      .map((el) => normalizeSpace(el.textContent))
      .filter(Boolean);
    if (emails.length) return Array.from(new Set(emails)).join("; ");
    return "";
  }

  function readFinancialRevenue(root) {
    const map = new Map();
    const titleEls = Array.from(root.querySelectorAll(".data-title"));
    titleEls.forEach((el) => {
      const text = normalizeSpace(el.textContent);
      const match = text.match(/Nettó árbevétel\s*\((\d{4})\)/i);
      if (!match) return;
      const year = parseInt(match[1], 10);
      const row = el.closest(".row") || el.parentElement;
      const value = normalizeSpace(row?.querySelector(".data-value")?.textContent || "");
      if (value) map.set(year, value);
    });
    const years = Array.from(map.keys()).sort((a, b) => b - a);
    if (!years.length) return "";
    const latest = years[0];
    const prev = years.find((year) => year === latest - 1);
    const parts = [`${latest}: ${map.get(latest)}`];
    if (prev) parts.push(`${prev}: ${map.get(prev)}`);
    return parts.join("; ");
  }

  function readQuickReport(root) {
    const quickReport = root.querySelector("#quickReport");
    if (!quickReport) return "";
    const text = normalizeSpace(quickReport.querySelector(".fw-bold.fs-15")?.textContent || "");
    return text;
  }

  function readKapcsoltVallalkozasok(root) {
    const value = root.querySelector("#contactnetworkinfo .inner-contact-text");
    return normalizeSpace(value?.textContent || "");
  }

  function readCorporateOwnersCount(root) {
    const hoverTexts = Array.from(root.querySelectorAll("#khra .kh-item-hover"))
      .map((el) => normalizeSpace(el.textContent));
    const companies = hoverTexts.filter((text) => text.includes("A cég neve"));
    return companies.length ? String(companies.length) : "";
  }

  function readBankAccounts(root) {
    const accounts = Array.from(root.querySelectorAll("#subhead-32 .head-title h3"))
      .map((el) => normalizeSpace(el.textContent))
      .filter(Boolean);
    return Array.from(new Set(accounts));
  }

  function parseIbanFromHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = Array.from(doc.querySelectorAll("#results table td"));
    for (let i = 0; i < rows.length; i++) {
      if (normalizeSpace(rows[i].textContent) === "IBAN") {
        return normalizeSpace(rows[i + 1]?.childNodes?.[0]?.textContent || rows[i + 1]?.textContent || "");
      }
    }
    return "";
  }

  function parseIbanCheckerFromHtml(html) {
    const doc = htmlToDocument(html);
    const table = doc.querySelector("#results table") || doc.querySelector("table");
    if (!table) return [];
    const rows = Array.from(table.querySelectorAll("tr"));
    const details = [];
    rows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 2) return;
      const key = normalizeSpace(cells[0].textContent).replace(/:$/, "");
      const value = normalizeSpace(cells[1].textContent);
      if (key && value) details.push([key, value]);
    });
    return details;
  }

  function htmlToDocument(html) {
    return new DOMParser().parseFromString(html, "text/html");
  }

  function requestHtml(url) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest not available"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url,
        onload: (response) => resolve(response.responseText || ""),
        onerror: () => reject(new Error("Request failed"))
      });
    });
  }

  function normalizeRegistryNumber(value) {
    return (value || "").replace(/\D/g, "");
  }

  function readRegistryNumberFromDoc(root) {
    const fromLabel = textFromLabel(root, "Cégjegyzékszám");
    if (fromLabel) return normalizeSpace(fromLabel.split("(")[0]);
    const head = normalizeSpace(root.querySelector("#subhead-1 .data-line--content")?.textContent || "");
    if (head) return normalizeSpace(head.split("(")[0]);
    const title = normalizeSpace(root.querySelector(".kh-heading .fs-medium")?.textContent || "");
    const match = title.match(/Cégjegyzékszám:\s*([0-9 ]+)/i);
    return match ? normalizeSpace(match[1]) : "";
  }

  function parseCegadatlap(root) {
    const base = buildPayload(root);
    const registryNumber = base.registryNumber || readRegistryNumberFromDoc(root);
    return {
      companyName: base.companyName,
      taxId: base.taxId,
      registryNumber,
      address: base.address,
      companyForm: textFromLabel(root, "Cégforma") || textFromTitle(root, "Cégforma"),
      establishmentDate: textFromLabel(root, "Alakulás dátuma"),
      registrationDate: textFromLabel(root, "Bejegyzés dátuma"),
      activities: readTevekenysegek(root),
      headquarters: normalizeSpace(root.querySelector("#subhead-5 .head-title a")?.textContent || ""),
      telephelyek: readTelephelyek(root),
      statisticalNumber: normalizeSpace(root.querySelector("#subhead-20 h3")?.textContent || ""),
      emails: readEmails(root),
      signatories: readAuthorizedSignatories(root),
      bankAccounts: readBankAccounts(root)
    };
  }

  function parseCegriport(root) {
    return {
      kkv: textFromTitle(root, "KKV besorolás"),
      revenue: readFinancialRevenue(root),
      quickReport: readQuickReport(root),
      kapcsolatok: readKapcsoltVallalkozasok(root)
    };
  }

  function parseKapcsolatiHalo(root) {
    const hoverNodes = Array.from(root.querySelectorAll("#khra .kh-item-hover"));
    const companyNames = new Set();
    hoverNodes.forEach((node) => {
      const label = normalizeSpace(node.textContent);
      if (label.includes("A cég neve")) {
        const strong = node.querySelector("b");
        const name = normalizeSpace(strong?.textContent || "");
        if (name) companyNames.add(name);
      }
    });
    return {
      corporateOwnersCount: companyNames.size ? String(companyNames.size) : "",
      kapcsolatok: companyNames.size ? String(companyNames.size) : ""
    };
  }

  async function loadAllData() {
    const currentDoc = document;
    const base = parseCegadatlap(currentDoc);
    const registryNumberDigits = normalizeRegistryNumber(base.registryNumber);
    const eid = getEidFromUrl() || getEidFromDoc(currentDoc);
    const cegadatlapUrl = eid ? `https://www.opten.hu/cegtar/cegadatlap/${eid}` : "";
    const cegriportUrl = eid ? `https://www.opten.hu/cegtar/cegriport/${eid}` : "";
    const kapcsolatiHaloUrl = registryNumberDigits ? `https://www.opten.hu/cegtar/kapcsolati-halo/${registryNumberDigits}` : "";

    const results = {
      base,
      report: {},
      halo: {}
    };

    const requests = [];

    if (cegadatlapUrl) {
      requests.push(
        requestHtml(cegadatlapUrl)
          .then((html) => parseCegadatlap(htmlToDocument(html)))
          .then((data) => { results.base = { ...results.base, ...data }; })
          .catch(() => {})
      );
    }
    return "";
  }

    if (cegriportUrl) {
      requests.push(
        requestHtml(cegriportUrl)
          .then((html) => parseCegriport(htmlToDocument(html)))
          .then((data) => { results.report = data; })
          .catch(() => {})
      );
    }

    if (kapcsolatiHaloUrl) {
      requests.push(
        requestHtml(kapcsolatiHaloUrl)
          .then((html) => parseKapcsolatiHalo(htmlToDocument(html)))
          .then((data) => { results.halo = data; })
          .catch(() => {})
      );
    }

    await Promise.all(requests);

    const merged = {
      ...results.base,
      ...results.report,
      ...results.halo,
      eid: eid || base.eid,
      sourceUrl: window.location.href
    };

    if (!merged.kapcsolatok && results.halo?.kapcsolatok) {
      merged.kapcsolatok = results.halo.kapcsolatok;
    }

    return merged;
  }

  function requestIbanFromCalculator(account, countryCode = "HU") {
    return new Promise((resolve) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        resolve("");
        return;
      }
      const url = "https://www.iban.hu/calculate-iban";
      const data = new URLSearchParams({
        country: countryCode,
        account
      }).toString();
      GM_xmlhttpRequest({
        method: "POST",
        url,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        data,
        onload: (response) => resolve(parseIbanFromHtml(response.responseText || "")),
        onerror: () => resolve("")
      });
    });
  }

  function requestIbanChecker(iban) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("GM_xmlhttpRequest not available"));
        return;
      }
      const url = "https://www.iban.hu/iban-checker";
      const data = new URLSearchParams({ iban }).toString();
      GM_xmlhttpRequest({
        method: "POST",
        url,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        data,
        onload: (response) => resolve(parseIbanCheckerFromHtml(response.responseText || "")),
        onerror: () => reject(new Error("IBAN checker failed"))
      });
    });
  }

  function normalizeAccount(account) {
    return normalizeSpace(account).replace(/\s+/g, "");
  }

  async function calculateIbans(accounts) {
    const results = new Map();
    for (const account of accounts) {
      const normalized = normalizeAccount(account);
      if (/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(normalized)) {
        results.set(account, normalized);
        continue;
      }
      const iban = await requestIbanFromCalculator(normalized, "HU");
      results.set(account, iban || "IBAN számítás sikertelen");
    }
    return results;
  }

  async function collectPayload() {
    const data = currentData || await getAllData();
    const val = (value) => value || "";
    const list = (value) => Array.isArray(value) ? value.filter(Boolean).join("; ") : val(value);
    const signatoryList = (value) => {
      if (!Array.isArray(value)) return val(value);
      return value
        .map((item, index) => [
          `${index + 1}) Név: ${item.name}`,
          `Beosztás/jogkör: ${item.role}`,
          `Lakcím: ${item.address}`,
          `Születés ideje: ${item.birth}`,
          `Adóazonosító jel: ${item.taxId}`,
          `A képviselet módja: ${item.representation}`,
          `Hatályos: ${item.hatalyos}`
        ].join(" | "))
        .join("\n");
    };
    return {
      "Cégnév": val(data.companyName),
      "Cégforma": val(data.companyForm),
      "KKV besorolás": val(data.kkv),
      "Alakulás dátuma": val(data.establishmentDate),
      "Bejegyzés dátuma": val(data.registrationDate),
      "Tevékenységi köre(i)": list(data.activities),
      "Cég székhelye": val(data.headquarters),
      "Cég telephelye(i)": list(data.telephelyek),
      "Cégjegyzékszám": val(data.registryNumber),
      "Adószám": val(data.taxId),
      "Statisztikai számjele": val(data.statisticalNumber),
      "Email": val(data.emails),
      "Értékesítés nettó árbevétele": val(data.revenue),
      "Opten gyorsjelentés": val(data.quickReport),
      "Cégjegyzésre jogosultak": signatoryList(data.signatories),
      "Hány darab cég a cégben van": val(data.corporateOwnersCount),
      "Hány kapcsolata van különböző cégekkel": val(data.kapcsolatok),
      "EID": val(data.eid),
      "Forrás URL": val(data.sourceUrl)
    };
  }

  function renderDrawer(data) {
    const headerSub = document.getElementById(DRAWER_IDS.sub);
    if (headerSub) {
      headerSub.innerHTML = [
        data.registryNumber ? `<span>Cégjegyzékszám: ${data.registryNumber}</span>` : "",
        data.taxId ? `<span>Adószám: ${data.taxId}</span>` : "",
        data.address ? `<span>${data.address}</span>` : ""
      ].filter(Boolean).join("");
    }
    return "";
  }

    const body = document.getElementById(DRAWER_IDS.body);
    if (!body) return;
    body.innerHTML = "";

    const baseInfo = {
      "Cégnév": data.companyName,
      "Cégforma": data.companyForm,
      "KKV besorolás": data.kkv,
      "Alakulás dátuma": data.establishmentDate,
      "Bejegyzés dátuma": data.registrationDate,
      "Cég székhelye": data.headquarters,
      "Cégjegyzékszám": data.registryNumber,
      "Adószám": data.taxId,
      "Statisztikai számjele": data.statisticalNumber,
      "Email": data.emails,
      "Értékesítés nettó árbevétele": data.revenue,
      "Opten gyorsjelentés": data.quickReport,
      "Hány darab cég a cégben van": data.corporateOwnersCount,
      "Hány kapcsolata van különböző cégekkel": data.kapcsolatok
    };
    const bankAccounts = data.bankAccounts || [];
    const activities = Array.isArray(data.activities) ? data.activities : [];
    const telephelyek = Array.isArray(data.telephelyek) ? data.telephelyek : [];
    const signatories = Array.isArray(data.signatories) ? data.signatories : [];

    const coreRows = [
      buildRow("Cégnév", baseInfo["Cégnév"]),
      buildRow("Cégforma", baseInfo["Cégforma"]),
      buildRow("KKV besorolás", baseInfo["KKV besorolás"]),
      buildRow("Alakulás dátuma", baseInfo["Alakulás dátuma"]),
      buildRow("Bejegyzés dátuma", baseInfo["Bejegyzés dátuma"]),
      buildRow("Cég székhelye", baseInfo["Cég székhelye"], { multiline: true }),
      buildRow("Cégjegyzékszám", baseInfo["Cégjegyzékszám"]),
      buildRow("Adószám", baseInfo["Adószám"]),
      buildRow("Statisztikai számjele", baseInfo["Statisztikai számjele"]),
      buildRow("Email", baseInfo["Email"], { multiline: true }),
      buildRow("Értékesítés nettó árbevétele", baseInfo["Értékesítés nettó árbevétele"]),
      buildRow("Opten gyorsjelentés", baseInfo["Opten gyorsjelentés"])
    ];

    const computedRows = [
      buildRow("Hány darab cég a cégben van", baseInfo["Hány darab cég a cégben van"]),
      buildRow("Hány kapcsolata van különböző cégekkel", baseInfo["Hány kapcsolata van különböző cégekkel"])
    ];

    body.appendChild(buildSection("Cég adatok", coreRows));
    body.appendChild(buildSection("Számolt mezők", computedRows));

    activities.forEach((activity, index) => {
      body.appendChild(buildSection(`Tevékenységi kör ${index + 1}`, [
        buildRow("Tevékenység", activity)
      ]));
    });

    telephelyek.forEach((telephely, index) => {
      body.appendChild(buildSection(`Telephely ${index + 1}`, [
        buildRow("Cím", telephely, { multiline: true })
      ]));
    });

    signatories.forEach((person, index) => {
      body.appendChild(buildSection(`Cégjegyzésre jogosult ${index + 1}`, [
        buildRow("Név", person.name),
        buildRow("Beosztás/jogkör", person.role),
        buildRow("Lakcím", person.address, { multiline: true }),
        buildRow("Születés ideje", person.birth),
        buildRow("Adóazonosító jel", person.taxId),
        buildRow("A képviselet módja", person.representation),
        buildRow("Hatályos", person.hatalyos)
      ]));
    });

    const bankCardRefs = bankAccounts.map((account, index) => {
      const combinedRow = buildRow("Bankszámlaszám → IBAN", `${account} → Számítás folyamatban...`, { multiline: true });
      const checkerRow = buildRow("IBAN ellenőrzés", "Várakozás...", { multiline: true });
      const section = buildSection(`Bankszámla ${index + 1}`, [combinedRow, checkerRow]);
      body.appendChild(section);
      return {
        account,
        combinedInput: combinedRow.querySelector(".teya-value"),
        checkerInput: checkerRow.querySelector(".teya-value")
      };
    });

    if (bankAccounts.length) {
      calculateIbans(bankAccounts).then((map) => {
        bankCardRefs.forEach((ref) => {
          const iban = map.get(ref.account) || "";
          const combinedValue = iban ? `${ref.account} → ${iban}` : ref.account;
          ref.combinedInput.value = combinedValue;
          ref.combinedInput.rows = Math.min(8, Math.max(3, combinedValue.split("\n").length));
          if (!iban || iban.toLowerCase().includes("sikertelen")) {
            ref.checkerInput.value = "IBAN ellenőrzés nem elérhető.";
            return;
          }
          requestIbanChecker(iban).then((details) => {
            if (!details.length) {
              ref.checkerInput.value = "Nincs elérhető IBAN részlet.";
              return;
            }
            ref.checkerInput.value = details.map(([key, value]) => `${key}: ${value}`).join("\n");
            ref.checkerInput.rows = Math.min(10, Math.max(3, details.length));
          }).catch(() => {
            ref.checkerInput.value = "IBAN ellenőrzés sikertelen.";
          });
        });
      });
    }
  }

  function findReportLink() {
    const byId = document.getElementById(MENU_ANCHOR_ID);
    if (byId) return byId;
    const byHref = document.querySelector("a[href*='/cegtar/cegriport/']");
    if (byHref) return byHref;
    const byTitle = Array.from(document.querySelectorAll("a")).find((link) =>
      normalizeSpace(link.textContent).toLowerCase() === "riport"
    );
    return byTitle || null;
  }

  function findSidebarList() {
    return (
      document.querySelector("ul.sidebar-menu-group") ||
      document.querySelector("#sidebar-menu-blocks ul") ||
      document.querySelector(".sidebar-menu-blocks ul")
    );
  }

  function insertMenuItem() {
    // már beszúrtuk?
    if (document.getElementById(INSERTED_LI_ID)) return;

    const reportLink = findReportLink();
    const ul = reportLink?.closest("ul.sidebar-menu-group") || findSidebarList();
    if (!ul) return;

    const reportLi = reportLink?.closest("li.list-group-item");

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

    // beszúrás Riport elé, ha találjuk
    if (reportLi) {
      ul.insertBefore(li, reportLi);
    } else {
      ul.appendChild(li);
    }

    // click handler (nem navigál)
    const a = li.querySelector("a");
    a.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDrawer();
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
