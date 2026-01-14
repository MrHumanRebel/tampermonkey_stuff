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

  // -------------------------
  // Helpers
  // -------------------------
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function textFrom(selector) {
    const el = document.querySelector(selector);
    if (!el) return "";
    return (el.textContent || "").trim();
  }

  function normalizeSpace(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function textFromLabel(labelText) {
    const labels = Array.from(document.querySelectorAll(".data-line--label"));
    const match = labels.find((label) =>
      normalizeSpace(label.textContent || "").toLowerCase().includes(labelText.toLowerCase())
    );
    const value = match?.parentElement?.querySelector(".data-line--content");
    return normalizeSpace(value?.textContent || "");
  }

  function textFromTitle(titleText) {
    const titles = Array.from(document.querySelectorAll(".data-title"));
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

  function buildPayload() {
    const name =
      textFrom(SELECTORS.companyName) ||
      normalizeSpace(document.querySelector("#subhead-2 .head-title h3")?.textContent) ||
      normalizeSpace(document.querySelector("h1")?.textContent) ||
      normalizeSpace(document.title);

    const taxId =
      textFrom(SELECTORS.taxId) ||
      normalizeSpace(document.querySelector("#subhead-21 h3")?.textContent) ||
      textFromLabel("Adószám");

    return {
      companyName: name || "",
      taxId,
      registryNumber: textFrom(SELECTORS.registryNumber) || textFromLabel("Cégjegyzékszám"),
      address: textFrom(SELECTORS.address) || normalizeSpace(document.querySelector("#subhead-5 .head-title a")?.textContent),
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

    document.getElementById("teya_copy_json").addEventListener("click", () => {
      const payload = collectPayload();
      const ok = safeCopy(JSON.stringify(payload, null, 2));
      showToast(ok ? "JSON másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_copy_block").addEventListener("click", () => {
      const payload = collectPayload();
      const lines = Object.entries(payload)
        .filter(([, value]) => value !== "")
        .map(([key, value]) => `${key}: ${value}`);
      const ok = safeCopy(lines.join("\n"));
      showToast(ok ? "Onboarding blokk másolva." : "Másolás sikertelen (clipboard tiltás?).");
    });

    document.getElementById("teya_open_teya").addEventListener("click", () => {
      if (!TEYA_ONBOARDING_BASE_URL) return;
      const payload = collectPayload();
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
    renderDrawer();
    document.getElementById(DRAWER_IDS.drawer)?.classList.add("show");
    document.getElementById(DRAWER_IDS.backdrop)?.classList.add("show");
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

  function readAuthorizedSignatories() {
    const items = Array.from(document.querySelectorAll("#subhead-13 .oi-list-item"));
    if (!items.length) return "";
    const findLabelValue = (root, labelText) => {
      const labels = Array.from(root.querySelectorAll(".data-line--label"));
      const match = labels.find((label) =>
        normalizeSpace(label.textContent || "").toLowerCase().includes(labelText.toLowerCase())
      );
      return normalizeSpace(match?.parentElement?.querySelector(".data-line--content")?.textContent || "");
    };
    const lines = items.map((item, index) => {
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

      return [
        `${index + 1}) Név: ${name || "ISMERETLEN"}`,
        `Beosztás/jogkör: ${role || "ISMERETLEN"}`,
        `Lakcím: ${address || "ISMERETLEN"}`,
        `Születés ideje: ${birth || "ISMERETLEN"}`,
        `Adóazonosító jel: ${taxId || "ISMERETLEN"}`,
        `A képviselet módja: ${representation || "ISMERETLEN"}`,
        `Hatályos: ${hatalyos || "ISMERETLEN"}`
      ].join(" | ");
    });
    return lines.join("\n");
  }

  function readTelephelyek() {
    const nodes = Array.from(document.querySelectorAll("#subhead-6 .head-title a"));
    return nodes.map((node) => normalizeSpace(node.textContent)).filter(Boolean).join("; ");
  }

  function readTevekenysegek() {
    const list = Array.from(document.querySelectorAll("#subhead-9 .title-text"))
      .map((el) => normalizeSpace(el.textContent))
      .filter(Boolean);
    if (list.length) return list.join("; ");
    return textFromTitle("Főtevékenysége");
  }

  function readEmails() {
    const emails = Array.from(document.querySelectorAll("#subhead-90 a[href^='mailto:']"))
      .map((el) => normalizeSpace(el.textContent))
      .filter(Boolean);
    if (emails.length) return Array.from(new Set(emails)).join("; ");
    return "";
  }

  function readFinancialRevenue() {
    const map = new Map();
    const titleEls = Array.from(document.querySelectorAll(".data-title"));
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

  function readQuickReport() {
    const quickReport = document.querySelector("#quickReport");
    if (!quickReport) return "";
    const text = normalizeSpace(quickReport.querySelector(".fw-bold.fs-15")?.textContent || "");
    return text;
  }

  function readKapcsoltVallalkozasok() {
    const value = document.querySelector("#contactnetworkinfo .inner-contact-text");
    return normalizeSpace(value?.textContent || "");
  }

  function readCorporateOwnersCount() {
    const hoverTexts = Array.from(document.querySelectorAll("#khra .kh-item-hover"))
      .map((el) => normalizeSpace(el.textContent));
    const companies = hoverTexts.filter((text) => text.includes("A cég neve"));
    return companies.length ? String(companies.length) : "";
  }

  function readBankAccounts() {
    const accounts = Array.from(document.querySelectorAll("#subhead-32 .head-title h3"))
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

  function collectPayload() {
    const base = buildPayload();
    const companyForm = textFromLabel("Cégforma") || textFromTitle("Cégforma");
    const kkv = textFromTitle("KKV besorolás");
    const establishmentDate = textFromLabel("Alakulás dátuma");
    const registrationDate = textFromLabel("Bejegyzés dátuma");
    const activities = readTevekenysegek();
    const headquarters = normalizeSpace(document.querySelector("#subhead-5 .head-title a")?.textContent || "");
    const telephelyek = readTelephelyek();
    const statisticalNumber = normalizeSpace(document.querySelector("#subhead-20 h3")?.textContent || "");
    const revenue = readFinancialRevenue();
    const quickReport = readQuickReport();
    const signatories = readAuthorizedSignatories();
    const corporateOwners = readCorporateOwnersCount();
    const kapcsolatok = readKapcsoltVallalkozasok();
    const emails = readEmails();

    return {
      "Cégnév": base.companyName,
      "Cégforma": companyForm,
      "KKV besorolás": kkv,
      "Alakulás dátuma": establishmentDate,
      "Bejegyzés dátuma": registrationDate,
      "Tevékenységi köre(i)": activities,
      "Cég székhelye": headquarters,
      "Cég telephelye(i)": telephelyek,
      "Cégjegyzékszám": base.registryNumber,
      "Adószám": base.taxId,
      "Statisztikai számjele": statisticalNumber,
      "Email": emails,
      "Értékesítés nettó árbevétele": revenue,
      "Opten gyorsjelentés": quickReport,
      "Cégjegyzésre jogosultak": signatories,
      "Hány darab cég a cégben van": corporateOwners,
      "Hány kapcsolata van különböző cégekkel": kapcsolatok,
      "EID": base.eid,
      "Forrás URL": base.sourceUrl
    };
  }

  function renderDrawer() {
    const payload = buildPayload();
    const headerSub = document.getElementById(DRAWER_IDS.sub);
    if (headerSub) {
      headerSub.innerHTML = [
        payload.registryNumber ? `<span>Cégjegyzékszám: ${payload.registryNumber}</span>` : "",
        payload.taxId ? `<span>Adószám: ${payload.taxId}</span>` : "",
        payload.address ? `<span>${payload.address}</span>` : ""
      ].filter(Boolean).join("");
    }

    const body = document.getElementById(DRAWER_IDS.body);
    if (!body) return;
    body.innerHTML = "";

    const baseInfo = collectPayload();
    const bankAccounts = readBankAccounts();

    const coreRows = [
      buildRow("Cégnév", baseInfo["Cégnév"]),
      buildRow("Cégforma", baseInfo["Cégforma"]),
      buildRow("KKV besorolás", baseInfo["KKV besorolás"]),
      buildRow("Alakulás dátuma", baseInfo["Alakulás dátuma"]),
      buildRow("Bejegyzés dátuma", baseInfo["Bejegyzés dátuma"]),
      buildRow("Tevékenységi köre(i)", baseInfo["Tevékenységi köre(i)"], { multiline: true }),
      buildRow("Cég székhelye", baseInfo["Cég székhelye"], { multiline: true }),
      buildRow("Cég telephelye(i)", baseInfo["Cég telephelye(i)"], { multiline: true }),
      buildRow("Cégjegyzékszám", baseInfo["Cégjegyzékszám"]),
      buildRow("Adószám", baseInfo["Adószám"]),
      buildRow("Statisztikai számjele", baseInfo["Statisztikai számjele"]),
      buildRow("Email", baseInfo["Email"], { multiline: true }),
      buildRow("Értékesítés nettó árbevétele", baseInfo["Értékesítés nettó árbevétele"]),
      buildRow("Opten gyorsjelentés", baseInfo["Opten gyorsjelentés"])
    ];

    const signatoryRows = [
      buildRow("Cégjegyzésre jogosult(ak) adatai", baseInfo["Cégjegyzésre jogosultak"], { multiline: true })
    ];

    const computedRows = [
      buildRow("Hány darab cég a cégben van", baseInfo["Hány darab cég a cégben van"]),
      buildRow("Hány kapcsolata van különböző cégekkel", baseInfo["Hány kapcsolata van különböző cégekkel"])
    ];

    const bankRows = [
      buildRow("Bankszámlaszám(ok)", bankAccounts.join("; "), { multiline: true }),
      buildRow("IBAN(ok)", bankAccounts.length ? "Számítás folyamatban..." : "")
    ];

    body.appendChild(buildSection("Cég adatok", coreRows));
    body.appendChild(buildSection("Cégjegyzésre jogosultak", signatoryRows));
    body.appendChild(buildSection("Számolt mezők", computedRows));
    body.appendChild(buildSection("Bankszámlák", bankRows));

    if (bankAccounts.length) {
      const ibanRow = bankRows[1].querySelector(".teya-value");
      calculateIbans(bankAccounts).then((map) => {
        const values = bankAccounts.map((account) => {
          const iban = map.get(account) || "";
          return iban ? `${account} → ${iban}` : account;
        });
        ibanRow.value = values.join("\n");
        ibanRow.rows = Math.min(8, Math.max(3, values.length));
      });
    }
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
