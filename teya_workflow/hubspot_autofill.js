// ==UserScript==
// @name         HubSpot – Opten JSON Autofill
// @namespace    https://teya.local/
// @version      0.2.0
// @description  Adds a "Fill JSON" button in HubSpot forms to autofill data from Opten JSON exports.
// @author       You
// @match        https://app-eu1.hubspot.com/*
// @match        https://app.hubspot.com/*
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const BUTTON_CLASS = "teya-fill-json-button";
  const OVERLAY_ID = "teya-fill-json-overlay";

  const STATIC_VALUES = {
    "Deal type": "New Customer",
    "Source": "Self-generated",
    "Priority": "Medium",
    "Close Date": () => formatDate(addMonths(new Date(), 1)),
    "Pipeline": "HU Direct Sales",
    "Deal owner": "Dani Székely"
  };

  const LABEL_RULES = [
    { match: /Company Name/i, key: "Cégnév" },
    { match: /Company Address|Address/i, key: "Cég székhelye" },
    { match: /Tax ID|VAT|Adószám/i, key: "Adószám" },
    { match: /Registration Number|Company Registration|Registry Number/i, key: "Cégjegyzékszám \/ Nyilvántartási szám" },
    { match: /Email/i, key: "Email" },
    { match: /Phone|Telefon/i, key: "Telefon" },
    { match: /Annual Revenue|Net Revenue|Értékesítés nettó árbevétele/i, key: "Értékesítés nettó árbevétele" },
    { match: /Monthly Card Revenue|Becsült kártyás nettó havi árbevétele|Sales expected monthly TPV/i, key: "Becsült kártyás nettó havi árbevétele" },
    { match: /MCC Average Basket|MCC átlagos kosárérték/i, key: "MCC átlagos kosárérték (HUF)" }
  ];

  const CONTACT_LABELS = {
    firstName: /First Name/i,
    lastName: /Last Name/i
  };

  const PROPERTY_RULES = {
    hubspot_owner_id: { static: "Deal owner" },
    company_name: { keys: ["Cégnév"] },
    dealtype: { static: "Deal type" },
    email: { keys: ["Email", "E-mail"] },
    phone: { keys: ["Telefon", "Telefonszám", "Phone"] },
    first_name: { contact: "firstName" },
    last_name: { contact: "lastName" },
    hs_priority: { static: "Priority" },
    description: { dynamic: "dealDescription" }
  };

  const BANK_KEYWORDS = {
    OTP: ["otp"],
    "K&H": ["k&h", "kh bank", "k h"],
    MBH: ["mbh", "mkb", "takarék"],
    Raiffeisen: ["raiffeisen"],
    Erste: ["erste"],
    CIB: ["cib"],
    UniCredit: ["unicredit"],
    Revolut: ["revolut"],
    Wise: ["wise"]
  };

  const STYLE = `
    .${BUTTON_CLASS} {
      margin-right: 8px;
      padding: 7px 14px;
      border-radius: 999px;
      border: 1px solid #ff6a2a;
      background: linear-gradient(135deg, #ff5a1f 0%, #ff7a29 100%);
      color: #fff;
      font-weight: 700;
      cursor: pointer;
      font-size: 12px;
      line-height: 1;
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(255, 90, 31, 0.28);
      transition: transform 120ms ease, box-shadow 120ms ease, filter 120ms ease;
    }
    .${BUTTON_CLASS}:hover {
      filter: brightness(1.03);
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(255, 90, 31, 0.35);
    }
    .${BUTTON_CLASS}:active {
      transform: translateY(0);
    }
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    #${OVERLAY_ID} .teya-modal {
      background: #fff;
      padding: 20px;
      border-radius: 8px;
      width: 420px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
      font-family: Arial, sans-serif;
    }
    #${OVERLAY_ID} .teya-modal h2 {
      margin: 0 0 12px;
      font-size: 16px;
    }
    #${OVERLAY_ID} .teya-modal label {
      display: block;
      margin-top: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    #${OVERLAY_ID} .teya-modal select {
      width: 100%;
      margin-top: 6px;
      padding: 6px;
      font-size: 12px;
    }
    #${OVERLAY_ID} .teya-modal .actions {
      margin-top: 16px;
      text-align: right;
    }
    #${OVERLAY_ID} .teya-modal button {
      padding: 6px 12px;
      border-radius: 4px;
      border: none;
      background: #ff4800;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
  `;

  injectStyles();
  initObserver();

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function initObserver() {
    const observer = new MutationObserver(() => {
      addFillButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    addFillButtons();
  }

  function addFillButtons() {
    addDealViewButton();

    const closeButtons = document.querySelectorAll(
      [
        "header button[aria-label='Close']",
        "header button[aria-label='Close panel']",
        "header button[data-test-id*='close']",
        "header button[data-test-id*='Close']",
        "[data-test-id*='header'] button[aria-label='Close']",
        "[data-test-id*='header'] button[aria-label='Close panel']",
        "[data-test-id*='header'] button[data-test-id*='close']",
        "[data-test-id*='header'] button[data-test-id*='Close']"
      ].join(", ")
    );

    closeButtons.forEach((closeButton) => {
      const actionTarget = findActionTarget(closeButton);
      const parent = actionTarget?.container
        || closeButton.closest("header")
        || closeButton.closest("[data-test-id*='header']")
        || closeButton.parentElement;
      if (!parent || parent.querySelector(`.${BUTTON_CLASS}`)) {
        return;
      }

      const fillButton = createFillButton(closeButton);
      parent.insertBefore(fillButton, closeButton);
    });
  }

  function findActionTarget(element) {
    if (!element) {
      return null;
    }

    const actionsContainer = element.closest("[data-selenium-test='crm-card-actions']")
      || element.closest("[data-test-id='crm-card-content']")?.querySelector("[data-selenium-test='crm-card-actions']")
      || element.closest("header")
      || element.parentElement;

    return { container: actionsContainer };
  }

  function addDealViewButton() {
    const aboutHeading = findAboutDealHeading();
    if (!aboutHeading) {
      return;
    }

    const container = aboutHeading.parentElement;
    if (!container || container.querySelector(`.${BUTTON_CLASS}`)) {
      return;
    }

    const fillButton = createFillButton();
    container.insertBefore(fillButton, aboutHeading);
  }

  function findAboutDealHeading() {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, [role='heading']"));
    return headings.find((heading) => heading.textContent.trim().toLowerCase() === "about this deal");
  }

  function createFillButton(closeButton) {
    const fillButton = document.createElement("button");
    fillButton.type = "button";
    fillButton.className = BUTTON_CLASS;
    fillButton.textContent = "Fill JSON";
    fillButton.addEventListener("click", () => handleFillClick(closeButton));
    return fillButton;
  }

  async function handleFillClick(closeButton) {
    const formRoot = findFormRoot(closeButton);
    if (!formRoot) {
      alert("Nem található aktív form.");
      return;
    }

    let jsonText = "";
    try {
      jsonText = await navigator.clipboard.readText();
    } catch (error) {
      jsonText = prompt("Illeszd be az Opten JSON-t:");
    }

    if (!jsonText) {
      alert("Nem érkezett JSON.");
      return;
    }

    let data;
    try {
      data = JSON.parse(jsonText);
    } catch (error) {
      alert("A JSON nem olvasható.");
      return;
    }

    const selection = await maybeSelectDetails(data);
    await fillForm(formRoot, data, selection);
  }

  function findFormRoot(closeButton) {
    const fromButton = closeButton
      ? (closeButton.closest("form") || closeButton.closest("[role='dialog']"))
      : null;
    return fromButton || document.querySelector("form") || document.querySelector("[role='main']");
  }

  async function maybeSelectDetails(data) {
    const officers = parseOfficerList(data["Cégjegyzésre jogosultak"]);
    const bankAccounts = parseBankAccounts(data);

    const needsOfficer = officers.length > 1;
    const needsBank = bankAccounts.length > 1;

    if (!needsOfficer && !needsBank) {
      return {
        officer: officers[0] || null,
        bankAccount: bankAccounts[0] || null
      };
    }

    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.innerHTML = `
        <div class="teya-modal">
          <h2>Válassz adatot a kitöltéshez</h2>
          ${needsOfficer ? buildSelect("Kapcsolattartó / Cégjegyzésre jogosult", "teya-officer", officers) : ""}
          ${needsBank ? buildSelect("Bankszámla", "teya-bank", bankAccounts) : ""}
          <div class="actions">
            <button type="button" class="teya-confirm">Kitöltés</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      overlay.querySelector(".teya-confirm").addEventListener("click", () => {
        const officerValue = needsOfficer
          ? overlay.querySelector("#teya-officer").value
          : officers[0] || null;
        const bankValue = needsBank
          ? overlay.querySelector("#teya-bank").value
          : bankAccounts[0] || null;

        overlay.remove();
        resolve({
          officer: officerValue || null,
          bankAccount: bankValue || null
        });
      });
    });
  }

  function buildSelect(label, id, options) {
    const optionMarkup = options
      .map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`)
      .join("");

    return `
      <label for="${id}">${label}</label>
      <select id="${id}">
        ${optionMarkup}
      </select>
    `;
  }

  function parseOfficerList(value) {
    if (!value || typeof value !== "string") {
      return [];
    }

    const matches = [...value.matchAll(/\d+\)\s*([^|]+)\|/g)].map((match) => match[1].trim());
    if (matches.length) {
      return matches;
    }

    return value
      .split(/\n|;|\s\|\s/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function parseBankAccounts(data) {
    const accounts = [];
    Object.keys(data || {}).forEach((key) => {
      if (/banksz[aá]mla|bank account|iban/i.test(key)) {
        const value = data[key];
        if (typeof value === "string") {
          value
            .split(/\n|;|,/)
            .map((entry) => entry.trim())
            .filter(Boolean)
            .forEach((entry) => accounts.push(entry));
        }
      }
    });

    return accounts;
  }

  async function fillForm(formRoot, data, selection) {
    const officerName = selection?.officer || data["Cégjegyzésre jogosultak"] || "";
    const contact = splitName(officerName);
    const context = buildContext(data, selection);

    await fillByPropertySelectors(formRoot, data, contact);

    const fields = Array.from(formRoot.querySelectorAll("label"));

    for (const label of fields) {
      const labelText = label.textContent.trim();
      if (!labelText) {
        continue;
      }

      if (await applySmartDefaults(label, labelText, data, context, contact)) {
        continue;
      }

      const staticValue = getStaticValue(labelText);
      if (staticValue !== null) {
        await fillFieldForLabel(label, staticValue);
        continue;
      }

      if (CONTACT_LABELS.firstName.test(labelText) && contact.firstName) {
        await fillFieldForLabel(label, contact.firstName);
        continue;
      }

      if (CONTACT_LABELS.lastName.test(labelText) && contact.lastName) {
        await fillFieldForLabel(label, contact.lastName);
        continue;
      }

      if (/Business Category/i.test(labelText) && context.businessCategory) {
        await fillFieldForLabel(label, context.businessCategory);
        continue;
      }

      if (/Business Activity/i.test(labelText) && context.businessActivity) {
        await fillFieldForLabel(label, context.businessActivity);
        continue;
      }

      const rule = LABEL_RULES.find((entry) => entry.match.test(labelText));
      if (rule) {
        const value = data[rule.key];
        if (value) {
          await fillFieldForLabel(label, value);
        }
      }
    }
  }

  function buildContext(data, selection) {
    const address = getDataValue(data, ["Cég székhelye", "Cég telephelye(i)"]);
    const bankRaw = selection?.bankAccount || parseBankAccounts(data)[0] || "";
    const bankProvider = inferBankProvider(bankRaw);
    const activityText = getDataValue(data, ["Tevékenységi köre(i)"]);
    const businessMapping = inferBusinessMapping(activityText);

    return {
      monthlyTPV: normalizeAmount(getDataValue(data, ["Becsült kártyás nettó havi árbevétele"])),
      expectedUseDate: formatDate(addDays(new Date(), 7)),
      storeStreet: extractStreet(address),
      storeCostCode: extractPostalCode(address) || getDataValue(data, ["Cégjegyzékszám / Nyilvántartási szám", "EID"]),
      bankProvider,
      businessCategory: businessMapping.category,
      businessActivity: businessMapping.activity
    };
  }

  async function applySmartDefaults(label, labelText, data, context, contact) {
    if (/NSR Acquiring/i.test(labelText)) {
      return true;
    }

    if (/Products of Interest/i.test(labelText)) {
      await fillFieldForLabel(label, ["Acquiring", "Physical Terminal"]);
      return true;
    }

    if (/Products Sold/i.test(labelText)) {
      await fillFieldForLabel(label, ["Acquiring", "Physical Terminal"]);
      return true;
    }

    if (/Decision Maker Contacted/i.test(labelText)) {
      await fillFieldForLabel(label, "Yes");
      return true;
    }

    if (/Identification of Need/i.test(labelText)) {
      await fillFieldForLabel(label, "Looking for value-added products");
      return true;
    }

    if (/Number of Stores/i.test(labelText)) {
      await fillFieldForLabel(label, "1");
      return true;
    }

    if (/Seasonality/i.test(labelText)) {
      await fillFieldForLabel(label, "Normal");
      return true;
    }

    if (/Priority/i.test(labelText)) {
      await fillFieldForLabel(label, "Medium");
      return true;
    }

    if (/Deal Type/i.test(labelText)) {
      await fillFieldForLabel(label, "New Customer");
      return true;
    }

    if (/Sales expected monthly TPV/i.test(labelText) && context.monthlyTPV) {
      await fillFieldForLabel(label, context.monthlyTPV);
      return true;
    }

    if (/Contract Term/i.test(labelText)) {
      await fillFieldForLabel(label, "12");
      return true;
    }

    if (/Terminal Unit Price/i.test(labelText)) {
      await fillFieldForLabel(label, "-1600");
      return true;
    }

    if (/Terminal Price Interval/i.test(labelText)) {
      await fillFieldForLabel(label, "Monthly");
      return true;
    }

    if (/Number of Terminals/i.test(labelText)) {
      await fillFieldForLabel(label, "1");
      return true;
    }

    if (/Expected Use Date/i.test(labelText)) {
      await fillFieldForLabel(label, context.expectedUseDate);
      return true;
    }

    if (/Store Street/i.test(labelText) && context.storeStreet) {
      await fillFieldForLabel(label, context.storeStreet);
      return true;
    }

    if (/Store Cost Code/i.test(labelText) && context.storeCostCode) {
      await fillFieldForLabel(label, context.storeCostCode);
      return true;
    }

    if (/Terminal Type/i.test(labelText)) {
      await fillFieldForLabel(label, "Sunmi");
      return true;
    }

    if (/Acquiring Provider/i.test(labelText) && context.bankProvider) {
      await fillFieldForLabel(label, context.bankProvider);
      return true;
    }

    if (/Banking Provider/i.test(labelText) && context.bankProvider) {
      await fillFieldForLabel(label, context.bankProvider);
      return true;
    }

    if (CONTACT_LABELS.firstName.test(labelText) && contact.firstName) {
      await fillFieldForLabel(label, contact.firstName);
      return true;
    }

    if (CONTACT_LABELS.lastName.test(labelText) && contact.lastName) {
      await fillFieldForLabel(label, contact.lastName);
      return true;
    }

    if (/Business Category/i.test(labelText) && context.businessCategory) {
      await fillFieldForLabel(label, context.businessCategory);
      return true;
    }

    if (/Business Activity/i.test(labelText) && context.businessActivity) {
      await fillFieldForLabel(label, context.businessActivity);
      return true;
    }

    return false;
  }

  async function fillByPropertySelectors(formRoot, data, contact) {
    for (const [propertyId, rule] of Object.entries(PROPERTY_RULES)) {
      let value = "";

      if (rule.static) {
        value = getStaticValue(rule.static);
      } else if (rule.contact) {
        value = contact?.[rule.contact] || "";
      } else if (rule.keys) {
        value = getDataValue(data, rule.keys);
      } else if (rule.dynamic === "dealDescription") {
        value = buildDealDescription(data);
      }

      if (!value) {
        continue;
      }

      const field = formRoot.querySelector(`[data-selenium-test='property-input-${propertyId}']`);
      if (!field) {
        continue;
      }

      await fillElementValue(field, value);
    }
  }

  function getDataValue(data, keys) {
    for (const key of keys) {
      if (typeof data?.[key] === "string" && data[key].trim()) {
        return data[key].trim();
      }
    }

    return "";
  }

  function buildDealDescription(data) {
    const summaryKeys = [
      "Cégforma",
      "Alakulás dátuma",
      "Bejegyzés dátuma",
      "Cég székhelye",
      "Adószám",
      "Cégjegyzékszám / Nyilvántartási szám",
      "Tevékenységi köre(i)",
      "Teya KYC státusz",
      "Teya KYC megjegyzés",
      "Opten gyorsjelentés",
      "Forrás URL"
    ];

    const lines = summaryKeys
      .map((key) => {
        const value = data?.[key];
        if (!value || !String(value).trim()) {
          return "";
        }

        return `${key}: ${String(value).trim()}`;
      })
      .filter(Boolean);

    return lines.join("\n");
  }

  function getStaticValue(labelText) {
    const direct = Object.keys(STATIC_VALUES).find((key) => key.toLowerCase() === labelText.toLowerCase());
    if (!direct) {
      return null;
    }

    const value = STATIC_VALUES[direct];
    return typeof value === "function" ? value() : value;
  }

  async function fillFieldForLabel(label, value) {
    const container = label.closest("[data-test-id='FormControl']") || label.parentElement;
    if (!container) {
      return;
    }

    const textInput = container.querySelector("input[type='text'], input[type='number'], input[type='date'], textarea");
    if (textInput) {
      await setInputValue(textInput, Array.isArray(value) ? value.join(", ") : value);
      return;
    }

    const dropdownButton = container.querySelector("button[data-dropdown]");
    if (dropdownButton) {
      if (Array.isArray(value)) {
        await selectDropdownValues(dropdownButton, value);
      } else {
        await selectDropdownValue(dropdownButton, value);
      }
    }
  }

  async function fillElementValue(field, value) {
    if (field.matches("input, textarea")) {
      await setInputValue(field, value);
      return;
    }

    if (field.matches("button[data-dropdown]")) {
      if (Array.isArray(value)) {
        await selectDropdownValues(field, value);
      } else {
        await selectDropdownValue(field, value);
      }
    }
  }

  async function setInputValue(input, value) {
    const stringValue = String(value ?? "");

    input.focus();
    input.click();
    await wait(40);

    const prototype = input.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(input, stringValue);
    } else {
      input.value = stringValue;
    }

    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
      data: stringValue
    }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));

    input.blur();
    await clickAway(input);
    await wait(120);
  }

  async function selectDropdownValues(button, values) {
    for (const value of values) {
      const current = normalizeText(button.textContent || "");
      if (current.includes(normalizeText(value))) {
        continue;
      }

      await selectDropdownValue(button, value);
      await wait(120);
    }
  }

  async function selectDropdownValue(button, value) {
    button.click();

    await wait(120);

    const normalizedTarget = normalizeText(value);
    const options = Array.from(document.querySelectorAll("[data-option-text='true']"));

    const option = options.find((item) => normalizeText(item.textContent || "") === normalizedTarget)
      || options.find((item) => normalizeText(item.textContent || "").includes(normalizedTarget))
      || options.find((item) => normalizedTarget.includes(normalizeText(item.textContent || "")));

    if (option) {
      option.click();
      await wait(80);
      await clickAway(button);
      await wait(120);
    } else {
      await clickAway(button);
    }

    const digits = String(value).replace(/[^0-9-]/g, "");
    return digits || "";
  }

  function extractStreet(address) {
    if (!address) {
      return "";
    }

    const parts = address.split(",");
    return parts.length > 1 ? parts.slice(1).join(",").trim() : address;
  }

  function extractPostalCode(address) {
    const match = String(address || "").match(/\b(\d{4})\b/);
    return match ? match[1] : "";
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }


  async function clickAway(sourceElement) {
    const target = sourceElement.closest("[data-properties-card-id]")
      || sourceElement.closest("[role='main']")
      || document.body;

    const rect = target.getBoundingClientRect();
    const x = Math.max(5, Math.floor(rect.left + Math.min(20, rect.width - 5)));
    const y = Math.max(5, Math.floor(rect.top + Math.min(20, rect.height - 5)));

    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: x, clientY: y }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: x, clientY: y }));
    target.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: y }));
    await wait(40);
  }

  function inferBusinessMapping(activityText) {
    const normalized = normalizeText(activityText);

    const rules = [
      { needle: "kiskereskedelem", category: "Retail", activity: "Home furnishing and household retail" },
      { needle: "vendeglatas", category: "Hospitality", activity: "Restaurant / catering" },
      { needle: "epitoipar", category: "Construction", activity: "Construction services" },
      { needle: "ingatlan", category: "Real estate", activity: "Real estate services" },
      { needle: "reklam", category: "Services", activity: "Marketing services" }
    ];

    const hit = rules.find((rule) => normalized.includes(rule.needle));

    return hit || {
      category: "Services",
      activity: "General business services"
    };
  }

  function inferBankProvider(bankRaw) {
    const normalized = normalizeText(bankRaw);
    const found = Object.entries(BANK_KEYWORDS).find(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeText(alias))));
    return found ? found[0] : "";
  }

  function normalizeAmount(value) {
    if (!value) {
      return "";
    }

    const digits = String(value).replace(/[^0-9-]/g, "");
    return digits || "";
  }

  function extractStreet(address) {
    if (!address) {
      return "";
    }

    const parts = address.split(",");
    return parts.length > 1 ? parts.slice(1).join(",").trim() : address;
  }

  function extractPostalCode(address) {
    const match = String(address || "").match(/\b(\d{4})\b/);
    return match ? match[1] : "";
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function splitName(raw) {
    if (!raw) {
      return { firstName: "", lastName: "" };
    }

    const cleaned = raw.replace(/\(.*?\)/g, "").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: "" };
    }

    return {
      firstName: parts.slice(0, -1).join(" "),
      lastName: parts.slice(-1).join(" ")
    };
  }

  function addMonths(date, months) {
    const newDate = new Date(date.getTime());
    newDate.setMonth(newDate.getMonth() + months);
    return newDate;
  }

  function addDays(date, days) {
    const newDate = new Date(date.getTime());
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  }

  function formatDate(date) {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
