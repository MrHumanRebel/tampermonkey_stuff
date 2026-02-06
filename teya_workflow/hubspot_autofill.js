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
  const BUTTON_FLOATING_CLASS = "teya-fill-json-button-floating";
  const BUTTON_TOPBAR_CLASS = "teya-fill-json-button-topbar";
  const OVERLAY_ID = "teya-fill-json-overlay";
  const LOG_PREFIX = "[TEYA Fill JSON]";
  const DEBUG_ENABLED = true;
  const HUMAN_DELAY_MIN_MS = 220;
  const HUMAN_DELAY_MAX_MS = 520;

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


  const BUSINESS_CATEGORY_HINTS = [
    {
      category: "Food and Beverage",
      activity: "Café / Restaurant",
      needles: ["etterem", "kavezo", "kávézó", "cafe", "restaurant", "vendeglatas", "vendéglátás", "bar", "pub", "bisztro", "bistro"]
    },
    {
      category: "Food and Beverage",
      activity: "Catering / Delivery",
      needles: ["catering", "kiszallitas", "kiszállítás", "delivery", "etelfutar", "ételfutár"]
    },
    {
      category: "Retail",
      activity: "Food / Grocery / Convenience / Corner Shops",
      needles: ["kiskereskedelem", "elelmiszer", "élelmiszer", "grocery", "convenience", "bolt", "aruhaz", "áruház"]
    },
    {
      category: "Retail",
      activity: "Furniture, Home Furnishings, and Equipment Stores",
      needles: ["butor", "bútor", "lakberendezes", "lakberendezés", "home furnishing", "5719", "4755"]
    },
    {
      category: "Services",
      activity: "Craftsman / Contractor",
      needles: ["epitoipar", "építőipar", "villanyszereles", "villanyszerelés", "burkolas", "burkolás", "festes", "festés", "tetofedes", "tetőfedés", "kozmuepites", "közműépítés"]
    },
    {
      category: "Services",
      activity: "Letting Agents",
      needles: ["ingatlan", "real estate", "letting", "6811", "6812", "6832"]
    },
    {
      category: "Services",
      activity: "Consulting",
      needles: ["tanacsadas", "tanácsadás", "consulting", "uzletviteli", "üzletviteli", "7020"]
    },
    {
      category: "Health, Beauty & Wellness",
      activity: "Beauty / Barber",
      needles: ["fodrasz", "fodrász", "kozmetika", "kozmetikus", "szepseg", "szépség", "barber", "beauty"]
    }
  ];

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
    .${BUTTON_TOPBAR_CLASS} {
      margin-left: 8px;
      margin-right: 0;
      height: 36px;
      padding: 0 12px;
      border-radius: 18px;
      font-size: 12px;
      line-height: 36px;
      white-space: nowrap;
      flex: 0 0 auto;
    }
    .${BUTTON_FLOATING_CLASS} {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 10000;
      padding: 10px 16px;
      font-size: 13px;
      border-radius: 999px;
      box-shadow: 0 10px 24px rgba(255, 90, 31, 0.35);
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

  function debug(message, details) {
    if (!DEBUG_ENABLED) {
      return;
    }

    if (typeof details === "undefined") {
      console.log(`${LOG_PREFIX} ${message}`);
      return;
    }

    console.log(`${LOG_PREFIX} ${message}`, details);
  }

  function debugField(action, labelText, value, extra = {}) {
    const preview = typeof value === "string"
      ? value.slice(0, 120)
      : value;

    debug(`${action} | field="${labelText}"`, {
      value: preview,
      ...extra
    });
  }

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
    const dealInserted = addDealViewButton();
    const propertiesInserted = addPropertiesCardButton();

    const activityInserted = typeof addCreateActivityButtonsBlockButton === "function"
      ? addCreateActivityButtonsBlockButton()
      : false;
    if (!activityInserted) {
      const topbarInserted = typeof addTopbarCreateButton === "function"
        ? addTopbarCreateButton()
        : false;
      if (!topbarInserted && typeof addActivityBarButton === "function") {
        addActivityBarButton();
      }
    }

    addFloatingFallbackButton(dealInserted || propertiesInserted || activityInserted);

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
      return false;
    }

    const headerRow = aboutHeading.closest("header")
      || aboutHeading.closest("[data-test-id*='header']")
      || aboutHeading.parentElement;
    if (!headerRow || headerRow.querySelector(`.${BUTTON_CLASS}`)) {
      return !!headerRow?.querySelector(`.${BUTTON_CLASS}`);
    }

    const fillButton = createFillButton();
    const actionsButton = headerRow.querySelector("[data-test-id*='actions']")
      || headerRow.querySelector("button[aria-label*='Actions']")
      || headerRow.querySelector("button[aria-haspopup='menu']");

    if (actionsButton && actionsButton.parentElement === headerRow) {
      headerRow.insertBefore(fillButton, actionsButton);
      return true;
    }

    headerRow.insertBefore(fillButton, aboutHeading);
    return true;
  }

  function addPropertiesCardButton() {
    const card = document.querySelector("[data-sidebar-card-type='PropertiesCard']")
      || document.querySelector("[data-card-type='PROPERTIES']")
      || document.querySelector("[data-test-id*='properties']");

    if (!card) {
      return false;
    }

    const actions = card.querySelector("[data-selenium-test='crm-card-actions']");
    const header = card.querySelector("header")
      || card.querySelector("[data-test-id*='header']")
      || card.querySelector(".ExpandableSection__ExpandableHeader-hBFtMA");
    const target = actions?.parentElement || header;

    if (!target || target.querySelector(`.${BUTTON_CLASS}`)) {
      return !!target?.querySelector(`.${BUTTON_CLASS}`);
    }

    const fillButton = createFillButton();
    if (actions && actions.parentElement) {
      actions.parentElement.insertBefore(fillButton, actions);
      return true;
    }

    target.appendChild(fillButton);
    return true;
  }

  function addFloatingFallbackButton(shouldSkip) {
    if (shouldSkip || document.querySelector(`.${BUTTON_CLASS}`) || document.querySelector(`.${BUTTON_FLOATING_CLASS}`)) {
      return;
    }

    const fillButton = createFillButton();
    fillButton.classList.add(BUTTON_FLOATING_CLASS);
    document.body.appendChild(fillButton);
  }

  function findAboutDealHeading() {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, h4, [role='heading']"));
    const labels = [
      "about this deal",
      "about the deal",
      "az uzletrol",
      "az ugyletrol"
    ];

    const matchHeading = headings.find((heading) => {
      const text = normalizeText(heading.textContent);
      return labels.includes(text);
    });

    if (matchHeading) {
      return matchHeading;
    }

    return headings.find((heading) => {
      const text = normalizeText(heading.textContent);
      return text.includes("about") && text.includes("deal");
    });
  }

  function createFillButton(closeButton) {
    const fillButton = document.createElement("button");
    fillButton.type = "button";
    fillButton.className = BUTTON_CLASS;
    fillButton.textContent = "Fill JSON";
    fillButton.addEventListener("click", () => handleFillClick({ closeButton, triggerButton: fillButton }));
    return fillButton;
  }

  async function handleFillClick(context = {}) {
    debug("Fill JSON clicked");
    const formRoot = findFormRoot(context);
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
      debug("JSON parsed successfully", { keys: Object.keys(data || {}), keyCount: Object.keys(data || {}).length });
    } catch (error) {
      debug("JSON parse failed", { error: String(error) });
      alert("A JSON nem olvasható.");
      return;
    }

    try {
      const selection = await maybeSelectDetails(data);
      debug("Selection resolved", selection);
      await fillForm(formRoot, data, selection);
      debug("Fill JSON finished");
    } catch (error) {
      debug("Fill JSON failed", { error: String(error) });
      alert(`Fill JSON hiba: ${String(error)}`);
    }
  }

  function findFormRoot(context = {}) {
    const { closeButton, triggerButton } = context;

    const candidates = [
      triggerButton?.closest("[data-sidebar-card-type='PropertiesCard']"),
      triggerButton?.closest("[data-test-id='crm-card-content']"),
      closeButton?.closest("[data-sidebar-card-type='PropertiesCard']"),
      closeButton?.closest("form"),
      closeButton?.closest("[role='dialog']"),
      findAboutDealHeading()?.closest("[data-sidebar-card-type='PropertiesCard']"),
      document.querySelector("[data-sidebar-card-type='PropertiesCard'] [data-selenium-test='profile-properties']")?.closest("[data-sidebar-card-type='PropertiesCard']"),
      document.querySelector("[data-selenium-test='profile-properties']"),
      document.querySelector("form"),
      document.querySelector("[role='main']")
    ].filter(Boolean);

    const root = candidates[0] || null;
    debug("Resolved form root", {
      candidateCount: candidates.length,
      rootTag: root?.tagName || null,
      rootTestId: root?.getAttribute?.("data-test-id") || null,
      rootSidebarType: root?.getAttribute?.("data-sidebar-card-type") || null
    });

    return root;
  }

  async function maybeSelectDetails(data) {
    const officers = parseOfficerList(data["Cégjegyzésre jogosultak"]);
    const bankAccounts = parseBankAccounts(data);

    const needsOfficer = officers.length > 1;
    const needsBank = bankAccounts.length > 1;

    debug("Parsed selectable details", { officers, bankAccounts, needsOfficer, needsBank });

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

  function collectFillLabels(formRoot) {
    const scoped = Array.from(formRoot.querySelectorAll("label"));
    const sidebarLabels = Array.from(document.querySelectorAll("[data-sidebar-card-type='PropertiesCard'] label"));
    const profileLabels = Array.from(document.querySelectorAll("[data-selenium-test='profile-properties'] label"));

    const all = [...scoped, ...sidebarLabels, ...profileLabels];
    return Array.from(new Set(all));
  }

  async function fillForm(formRoot, data, selection) {
    debug("Starting fillForm");
    const officerName = selection?.officer || data["Cégjegyzésre jogosultak"] || "";
    const contact = splitName(officerName);
    const context = buildContext(data, selection);

    await fillByPropertySelectors(formRoot, data, contact);

    const fields = collectFillLabels(formRoot);
    debug("Collected label fields", { count: fields.length });

    for (const label of fields) {
      const labelText = label.textContent.trim();
      if (!labelText) {
        continue;
      }

      debug("Processing label", { labelText });

      if (await applySmartDefaults(label, labelText, data, context, contact)) {
        continue;
      }

      const staticValue = getStaticValue(labelText);
      if (staticValue !== null) {
        debugField("Static mapping", labelText, staticValue);
        await fillFieldForLabel(label, staticValue);
        continue;
      }

      if (CONTACT_LABELS.firstName.test(labelText) && contact.firstName) {
        debugField("Contact mapping", labelText, contact.firstName);
      await fillFieldForLabel(label, contact.firstName);
        continue;
      }

      if (CONTACT_LABELS.lastName.test(labelText) && contact.lastName) {
        debugField("Contact mapping", labelText, contact.lastName);
      await fillFieldForLabel(label, contact.lastName);
        continue;
      }

      if (/Business Category/i.test(labelText) && context.businessCategory) {
        debugField("Business mapping", labelText, context.businessCategory);
      await fillFieldForLabel(label, context.businessCategory);
        continue;
      }

      if (/Business Activity/i.test(labelText) && context.businessActivity) {
        debugField("Business mapping", labelText, context.businessActivity);
      await fillFieldForLabel(label, context.businessActivity);
        continue;
      }

      const rule = LABEL_RULES.find((entry) => entry.match.test(labelText));
      if (rule) {
        const value = data[rule.key];
        if (value) {
          debugField("Label mapping", labelText, value, { sourceKey: rule.key });
          await fillFieldForLabel(label, value);
        } else {
          debug("Label mapping skipped (no source value)", { labelText, sourceKey: rule.key });
        }

        return `${key}: ${String(value).trim()}`;
      })
      .filter(Boolean);

    return lines.join("\n");
  }

  function buildContext(data, selection) {
    const address = getDataValue(data, ["Cég székhelye", "Cég telephelye(i)"]);
    const bankRaw = selection?.bankAccount || parseBankAccounts(data)[0] || "";
    const bankProvider = inferBankProvider(bankRaw);
    const activityText = getDataValue(data, ["Tevékenységi köre(i)"]);
    const businessMapping = inferBusinessMapping(activityText);

    const context = {
      monthlyTPV: normalizeAmount(getDataValue(data, ["Becsült kártyás nettó havi árbevétele"])),
      expectedUseDate: formatDate(addDays(new Date(), 7)),
      storeStreet: extractStreet(address),
      storeCostCode: extractPostalCode(address) || getDataValue(data, ["Cégjegyzékszám / Nyilvántartási szám", "EID"]),
      bankProvider,
      businessCategory: businessMapping.category,
      businessActivity: businessMapping.activity
    };

    debug("Computed fill context", context);
    return context;
  }

  async function applySmartDefaults(label, labelText, data, context, contact) {
    if (/NSR Acquiring/i.test(labelText)) {
      return true;
    }

    if (/Other Products of Interest/i.test(labelText)) {
      debug("Smart default skipped", { labelText, reason: "Must stay empty" });
      return true;
    }

    if (/Products of Interest/i.test(labelText)) {
      debugField("Smart default", labelText, ["Acquiring", "Physical Terminal"], { reason: "Products of Interest default" });
      await fillFieldForLabel(label, ["Acquiring", "Physical Terminal"]);
      return true;
    }

    if (/Products Sold/i.test(labelText)) {
      debugField("Smart default", labelText, ["Acquiring", "Physical Terminal"], { reason: "Products Sold default" });
      await fillFieldForLabel(label, ["Acquiring", "Physical Terminal"]);
      return true;
    }

    if (/Decision Maker Contacted/i.test(labelText)) {
      debugField("Smart default", labelText, "Yes", { reason: "Decision maker contacted" });
      await fillFieldForLabel(label, "Yes");
      return true;
    }

    if (/Identification of Need/i.test(labelText)) {
      debugField("Smart default", labelText, "Looking for value-added products", { reason: "Identification of Need" });
      await fillFieldForLabel(label, "Looking for value-added products");
      return true;
    }

    if (/Number of Stores/i.test(labelText)) {
      debugField("Smart default", labelText, "1", { reason: "Count default" });
      await fillFieldForLabel(label, "1");
      return true;
    }

    if (/Seasonality/i.test(labelText)) {
      debugField("Smart default", labelText, "Normal", { reason: "Seasonality default" });
      await fillFieldForLabel(label, "Normal");
      return true;
    }

    if (/Priority/i.test(labelText)) {
      debugField("Smart default", labelText, "Medium", { reason: "Priority default" });
      await fillFieldForLabel(label, "Medium");
      return true;
    }

    if (/Deal Type/i.test(labelText)) {
      debugField("Smart default", labelText, "New Customer", { reason: "Deal Type default" });
      await fillFieldForLabel(label, "New Customer");
      return true;
    }

    if (/Sales expected monthly TPV/i.test(labelText) && context.monthlyTPV) {
      debugField("Smart default", labelText, context.monthlyTPV, { reason: "Monthly TPV from Opten" });
      await fillFieldForLabel(label, context.monthlyTPV);
      return true;
    }

    if (/Contract Term/i.test(labelText)) {
      debugField("Smart default", labelText, "12", { reason: "Contract term default" });
      await fillFieldForLabel(label, "12");
      return true;
    }

    if (/Terminal Unit Price/i.test(labelText)) {
      debugField("Smart default", labelText, "-1600", { reason: "Terminal unit price default" });
      await fillFieldForLabel(label, "-1600");
      return true;
    }

    if (/Terminal Price Interval/i.test(labelText)) {
      debugField("Smart default", labelText, "Monthly", { reason: "Terminal interval default" });
      await fillFieldForLabel(label, "Monthly");
      return true;
    }

    if (/Number of Terminals/i.test(labelText)) {
      debugField("Smart default", labelText, "1", { reason: "Count default" });
      await fillFieldForLabel(label, "1");
      return true;
    }

    if (/Expected Use Date/i.test(labelText)) {
      debugField("Smart default", labelText, context.expectedUseDate, { reason: "Expected use date +7 days" });
      await fillFieldForLabel(label, context.expectedUseDate);
      return true;
    }

    if (/Store Street/i.test(labelText) && context.storeStreet) {
      debugField("Smart default", labelText, context.storeStreet, { reason: "Store street from address" });
      await fillFieldForLabel(label, context.storeStreet);
      return true;
    }

    if (/Store Cost Code/i.test(labelText) && context.storeCostCode) {
      debugField("Smart default", labelText, context.storeCostCode, { reason: "Store cost code derived" });
      await fillFieldForLabel(label, context.storeCostCode);
      return true;
    }

    if (/Terminal Type/i.test(labelText)) {
      debugField("Smart default", labelText, "Sunmi", { reason: "Terminal type default" });
      await fillFieldForLabel(label, "Sunmi");
      return true;
    }

    if (/Acquiring Provider/i.test(labelText) && context.bankProvider) {
      debugField("Smart default", labelText, context.bankProvider, { reason: "Provider from bank account" });
      await fillFieldForLabel(label, context.bankProvider);
      return true;
    }

    if (/Banking Provider/i.test(labelText) && context.bankProvider) {
      debugField("Smart default", labelText, context.bankProvider, { reason: "Provider from bank account" });
      await fillFieldForLabel(label, context.bankProvider);
      return true;
    }

    if (CONTACT_LABELS.firstName.test(labelText) && contact.firstName) {
      debugField("Contact mapping", labelText, contact.firstName);
      await fillFieldForLabel(label, contact.firstName);
      return true;
    }

    if (CONTACT_LABELS.lastName.test(labelText) && contact.lastName) {
      debugField("Contact mapping", labelText, contact.lastName);
      await fillFieldForLabel(label, contact.lastName);
      return true;
    }

    if (/Business Category/i.test(labelText) && context.businessCategory) {
      debugField("Business mapping", labelText, context.businessCategory);
      await fillFieldForLabel(label, context.businessCategory);
      return true;
    }

    if (/Business Activity/i.test(labelText) && context.businessActivity) {
      debugField("Business mapping", labelText, context.businessActivity);
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

      await humanPause();
    }
  }

  function buildContext(data, selection) {
    const address = getDataValue(data, ["Cég székhelye", "Cég telephelye(i)"]);
    const bankRaw = selection?.bankAccount || parseBankAccounts(data)[0] || "";
    const bankProvider = inferBankProvider(bankRaw);
    const activityText = getDataValue(data, ["Tevékenységi köre(i)"]);
    const businessMapping = inferBusinessMapping(activityText);

    const context = {
      monthlyTPV: normalizeAmount(getDataValue(data, ["Becsült kártyás nettó havi árbevétele"])),
      expectedUseDate: formatDate(addDays(new Date(), 7)),
      storeStreet: extractStreet(address),
      storeCostCode: extractPostalCode(address) || getDataValue(data, ["Cégjegyzékszám / Nyilvántartási szám", "EID"]),
      bankProvider,
      businessCategory: businessMapping.category,
      businessActivity: businessMapping.activity
    };

    debug("Computed fill context", context);
    return context;
  }

  async function applySmartDefaults(label, labelText, data, context, contact) {
    if (/NSR Acquiring/i.test(labelText)) {
      return true;
    }

    if (/Other Products of Interest/i.test(labelText)) {
      debug("Smart default skipped", { labelText, reason: "Must stay empty" });
      return true;
    }

    if (/Products of Interest/i.test(labelText)) {
      debugField("Smart default", labelText, ["Acquiring", "Physical Terminal"], { reason: "Products of Interest default" });
      await fillFieldForLabel(label, ["Acquiring", "Physical Terminal"]);
      return true;
    }

    if (/Products Sold/i.test(labelText)) {
      debugField("Smart default", labelText, ["Acquiring", "Physical Terminal"], { reason: "Products Sold default" });
      await fillFieldForLabel(label, ["Acquiring", "Physical Terminal"]);
      return true;
    }

    if (/Decision Maker Contacted/i.test(labelText)) {
      debugField("Smart default", labelText, "Yes", { reason: "Decision maker contacted" });
      await fillFieldForLabel(label, "Yes");
      return true;
    }

    if (/Identification of Need/i.test(labelText)) {
      debugField("Smart default", labelText, "Looking for value-added products", { reason: "Identification of Need" });
      await fillFieldForLabel(label, "Looking for value-added products");
      return true;
    }

    if (/Number of Stores/i.test(labelText)) {
      debugField("Smart default", labelText, "1", { reason: "Count default" });
      await fillFieldForLabel(label, "1");
      return true;
    }

    if (/Seasonality/i.test(labelText)) {
      debugField("Smart default", labelText, "Normal", { reason: "Seasonality default" });
      await fillFieldForLabel(label, "Normal");
      return true;
    }

    if (/Priority/i.test(labelText)) {
      debugField("Smart default", labelText, "Medium", { reason: "Priority default" });
      await fillFieldForLabel(label, "Medium");
      return true;
    }

    if (/Deal Type/i.test(labelText)) {
      debugField("Smart default", labelText, "New Customer", { reason: "Deal Type default" });
      await fillFieldForLabel(label, "New Customer");
      return true;
    }

    if (/Sales expected monthly TPV/i.test(labelText) && context.monthlyTPV) {
      debugField("Smart default", labelText, context.monthlyTPV, { reason: "Monthly TPV from Opten" });
      await fillFieldForLabel(label, context.monthlyTPV);
      return true;
    }

    if (/Contract Term/i.test(labelText)) {
      debugField("Smart default", labelText, "12", { reason: "Contract term default" });
      await fillFieldForLabel(label, "12");
      return true;
    }

    if (/Terminal Unit Price/i.test(labelText)) {
      debugField("Smart default", labelText, "-1600", { reason: "Terminal unit price default" });
      await fillFieldForLabel(label, "-1600");
      return true;
    }

    if (/Terminal Price Interval/i.test(labelText)) {
      debugField("Smart default", labelText, "Monthly", { reason: "Terminal interval default" });
      await fillFieldForLabel(label, "Monthly");
      return true;
    }

    if (/Number of Terminals/i.test(labelText)) {
      debugField("Smart default", labelText, "1", { reason: "Count default" });
      await fillFieldForLabel(label, "1");
      return true;
    }

    if (/Expected Use Date/i.test(labelText)) {
      debugField("Smart default", labelText, context.expectedUseDate, { reason: "Expected use date +7 days" });
      await fillFieldForLabel(label, context.expectedUseDate);
      return true;
    }

    if (/Store Street/i.test(labelText) && context.storeStreet) {
      debugField("Smart default", labelText, context.storeStreet, { reason: "Store street from address" });
      await fillFieldForLabel(label, context.storeStreet);
      return true;
    }

    if (/Store Cost Code/i.test(labelText) && context.storeCostCode) {
      debugField("Smart default", labelText, context.storeCostCode, { reason: "Store cost code derived" });
      await fillFieldForLabel(label, context.storeCostCode);
      return true;
    }

    if (/Terminal Type/i.test(labelText)) {
      debugField("Smart default", labelText, "Sunmi", { reason: "Terminal type default" });
      await fillFieldForLabel(label, "Sunmi");
      return true;
    }

    if (/Acquiring Provider/i.test(labelText) && context.bankProvider) {
      debugField("Smart default", labelText, context.bankProvider, { reason: "Provider from bank account" });
      await fillFieldForLabel(label, context.bankProvider);
      return true;
    }

    if (/Banking Provider/i.test(labelText) && context.bankProvider) {
      debugField("Smart default", labelText, context.bankProvider, { reason: "Provider from bank account" });
      await fillFieldForLabel(label, context.bankProvider);
      return true;
    }

    if (CONTACT_LABELS.firstName.test(labelText) && contact.firstName) {
      debugField("Contact mapping", labelText, contact.firstName);
      await fillFieldForLabel(label, contact.firstName);
      return true;
    }

    if (CONTACT_LABELS.lastName.test(labelText) && contact.lastName) {
      debugField("Contact mapping", labelText, contact.lastName);
      await fillFieldForLabel(label, contact.lastName);
      return true;
    }

    if (/Business Category/i.test(labelText) && context.businessCategory) {
      debugField("Business mapping", labelText, context.businessCategory);
      await fillFieldForLabel(label, context.businessCategory);
      return true;
    }

    if (/Business Activity/i.test(labelText) && context.businessActivity) {
      debugField("Business mapping", labelText, context.businessActivity);
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

      await humanPause();
    }
  }

  function buildContext(data, selection) {
    const address = getDataValue(data, ["Cég székhelye", "Cég telephelye(i)"]);
    const bankRaw = selection?.bankAccount || parseBankAccounts(data)[0] || "";
    const bankProvider = inferBankProvider(bankRaw);
    const activityText = getDataValue(data, ["Tevékenységi köre(i)"]);
    const businessMapping = inferBusinessMapping(activityText);

    const context = {
      monthlyTPV: normalizeAmount(getDataValue(data, ["Becsült kártyás nettó havi árbevétele"])),
      expectedUseDate: formatDate(addDays(new Date(), 7)),
      storeStreet: extractStreet(address),
      storeCostCode: extractPostalCode(address) || getDataValue(data, ["Cégjegyzékszám / Nyilvántartási szám", "EID"]),
      bankProvider,
      businessCategory: businessMapping.category,
      businessActivity: businessMapping.activity
    };

    debug("Computed fill context", context);
    return context;
  }

  async function applySmartDefaults(label, labelText, data, context, contact) {
    if (/NSR Acquiring/i.test(labelText)) {
      return true;
    }

    if (/Other Products of Interest/i.test(labelText)) {
      debug("Smart default skipped", { labelText, reason: "Must stay empty" });
      return true;
    }

    if (/Products of Interest/i.test(labelText)) {
      debugField("Smart default", labelText, ["Acquiring", "Physical Terminal"], { reason: "Products of Interest default" });
      await fillFieldForLabel(label, ["Acquiring", "Physical Terminal"]);
      return true;
    }

    if (/Products Sold/i.test(labelText)) {
      debugField("Smart default", labelText, ["Acquiring", "Physical Terminal"], { reason: "Products Sold default" });
      await fillFieldForLabel(label, ["Acquiring", "Physical Terminal"]);
      return true;
    }

    if (/Decision Maker Contacted/i.test(labelText)) {
      debugField("Smart default", labelText, "Yes", { reason: "Decision maker contacted" });
      await fillFieldForLabel(label, "Yes");
      return true;
    }

    if (/Identification of Need/i.test(labelText)) {
      debugField("Smart default", labelText, "Looking for value-added products", { reason: "Identification of Need" });
      await fillFieldForLabel(label, "Looking for value-added products");
      return true;
    }

    if (/Number of Stores/i.test(labelText)) {
      debugField("Smart default", labelText, "1", { reason: "Count default" });
      await fillFieldForLabel(label, "1");
      return true;
    }

    if (/Seasonality/i.test(labelText)) {
      debugField("Smart default", labelText, "Normal", { reason: "Seasonality default" });
      await fillFieldForLabel(label, "Normal");
      return true;
    }

    if (/Priority/i.test(labelText)) {
      debugField("Smart default", labelText, "Medium", { reason: "Priority default" });
      await fillFieldForLabel(label, "Medium");
      return true;
    }

    if (/Deal Type/i.test(labelText)) {
      debugField("Smart default", labelText, "New Customer", { reason: "Deal Type default" });
      await fillFieldForLabel(label, "New Customer");
      return true;
    }

    if (/Sales expected monthly TPV/i.test(labelText) && context.monthlyTPV) {
      debugField("Smart default", labelText, context.monthlyTPV, { reason: "Monthly TPV from Opten" });
      await fillFieldForLabel(label, context.monthlyTPV);
      return true;
    }

    if (/Contract Term/i.test(labelText)) {
      debugField("Smart default", labelText, "12", { reason: "Contract term default" });
      await fillFieldForLabel(label, "12");
      return true;
    }

    if (/Terminal Unit Price/i.test(labelText)) {
      debugField("Smart default", labelText, "-1600", { reason: "Terminal unit price default" });
      await fillFieldForLabel(label, "-1600");
      return true;
    }

    if (/Terminal Price Interval/i.test(labelText)) {
      debugField("Smart default", labelText, "Monthly", { reason: "Terminal interval default" });
      await fillFieldForLabel(label, "Monthly");
      return true;
    }

    if (/Number of Terminals/i.test(labelText)) {
      debugField("Smart default", labelText, "1", { reason: "Count default" });
      await fillFieldForLabel(label, "1");
      return true;
    }

    if (/Expected Use Date/i.test(labelText)) {
      debugField("Smart default", labelText, context.expectedUseDate, { reason: "Expected use date +7 days" });
      await fillFieldForLabel(label, context.expectedUseDate);
      return true;
    }

    if (/Store Street/i.test(labelText) && context.storeStreet) {
      debugField("Smart default", labelText, context.storeStreet, { reason: "Store street from address" });
      await fillFieldForLabel(label, context.storeStreet);
      return true;
    }

    if (/Store Cost Code/i.test(labelText) && context.storeCostCode) {
      debugField("Smart default", labelText, context.storeCostCode, { reason: "Store cost code derived" });
      await fillFieldForLabel(label, context.storeCostCode);
      return true;
    }

    if (/Terminal Type/i.test(labelText)) {
      debugField("Smart default", labelText, "Sunmi", { reason: "Terminal type default" });
      await fillFieldForLabel(label, "Sunmi");
      return true;
    }

    if (/Acquiring Provider/i.test(labelText) && context.bankProvider) {
      debugField("Smart default", labelText, context.bankProvider, { reason: "Provider from bank account" });
      await fillFieldForLabel(label, context.bankProvider);
      return true;
    }

    if (/Banking Provider/i.test(labelText) && context.bankProvider) {
      debugField("Smart default", labelText, context.bankProvider, { reason: "Provider from bank account" });
      await fillFieldForLabel(label, context.bankProvider);
      return true;
    }

    if (CONTACT_LABELS.firstName.test(labelText) && contact.firstName) {
      debugField("Contact mapping", labelText, contact.firstName);
      await fillFieldForLabel(label, contact.firstName);
      return true;
    }

    if (CONTACT_LABELS.lastName.test(labelText) && contact.lastName) {
      debugField("Contact mapping", labelText, contact.lastName);
      await fillFieldForLabel(label, contact.lastName);
      return true;
    }

    if (/Business Category/i.test(labelText) && context.businessCategory) {
      debugField("Business mapping", labelText, context.businessCategory);
      await fillFieldForLabel(label, context.businessCategory);
      return true;
    }

    if (/Business Activity/i.test(labelText) && context.businessActivity) {
      debugField("Business mapping", labelText, context.businessActivity);
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

      const field = formRoot.querySelector(`[data-selenium-test='property-input-${propertyId}']`)
        || document.querySelector(`[data-selenium-test='property-input-${propertyId}']`);
      if (!field) {
        debug("Property field not found", { propertyId, value });
        continue;
      }

      debug("Property selector fill", { propertyId, value });
      await fillElementValue(field, value, propertyId);
      await humanPause();
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
      "Adószám",
      "Cég székhelye",
      "Alakulás dátuma",
      "Bejegyzés dátuma"
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
    const labelText = label.textContent?.trim() || "";
    const forId = label.getAttribute("for");
    const forElement = forId ? document.getElementById(forId) : null;

    if (forElement) {
      if (forElement.matches("input, textarea")) {
        const resolved = Array.isArray(value) ? value.join(", ") : value;
        debugField("Text fill via label[for]", labelText, resolved, { type: forElement.type || forElement.tagName });
        await setInputValue(forElement, resolved, labelText);
        return;
      }

      if (forElement.matches("button[data-dropdown]")) {
        if (Array.isArray(value)) {
          debugField("Dropdown multi fill via label[for]", labelText, value);
          await selectDropdownValues(forElement, value, labelText);
        } else {
          debugField("Dropdown single fill via label[for]", labelText, value);
          await selectDropdownValue(forElement, value, labelText);
        }
        return;
      }
    }

    const container = label.closest("[data-test-id='DisplayOptimizedFormControl'], [data-test-id='FormControl']") || label.parentElement;
    if (!container) {
      debug("No container for label", { labelText });
      return;
    }

    const textInput = container.querySelector("input[type='text'], input[type='number'], input[type='date'], textarea");
    if (textInput) {
      const resolved = Array.isArray(value) ? value.join(", ") : value;
      debugField("Text fill", labelText, resolved, { type: textInput.type || textInput.tagName });
      await setInputValue(textInput, resolved, labelText);
      return;
    }

    const dropdownButton = container.querySelector("button[data-dropdown]");
    if (dropdownButton) {
      if (Array.isArray(value)) {
        debugField("Dropdown multi fill", labelText, value);
        await selectDropdownValues(dropdownButton, value, labelText);
      } else {
        debugField("Dropdown single fill", labelText, value);
        await selectDropdownValue(dropdownButton, value, labelText);
      }
    }
  }

  async function fillElementValue(field, value, fieldNameHint = "") {
    if (field.matches("input, textarea")) {
      await setInputValue(field, value, fieldNameHint);
      return;
    }

    if (field.matches("button[data-dropdown]")) {
      if (Array.isArray(value)) {
        await selectDropdownValues(field, value, fieldNameHint);
      } else {
        await selectDropdownValue(field, value, fieldNameHint);
      }
    }
  }

  async function setInputValue(input, value, fieldNameHint = "") {
    if (!input || input.disabled || input.readOnly) {
      debug("Input skipped (disabled/readonly)", { fieldNameHint });
      return;
    }

    const stringValue = String(value ?? "");

    input.focus();
    input.click();
    await humanPause(80, 180);

    const prototype = input.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(input, "");
    } else {
      input.value = "";
    }
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteContentBackward",
      data: ""
    }));

    for (const ch of stringValue) {
      const nextValue = `${input.value || ""}${ch}`;
      if (descriptor?.set) {
        descriptor.set.call(input, nextValue);
      } else {
        input.value = nextValue;
      }

      input.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: ch
      }));
      await humanPause(14, 32);
    }

    input.dispatchEvent(new Event("change", { bubbles: true }));

    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));

    input.blur();
    await clickAway(input);
    await waitForSaveConfirmation(fieldNameHint || resolveFieldName(input));
    await humanPause();
    debug("Input committed", { field: input.getAttribute("id") || input.getAttribute("data-selenium-test") || input.name || input.tagName, value: stringValue });
  }

  async function selectDropdownValues(button, values, fieldNameHint = "") {
    await clearDropdownSelections(button);

    for (const value of values) {
      await selectDropdownValue(button, value, fieldNameHint);
      await humanPause();
    }
  }

  async function clearDropdownSelections(button) {
    const container = button.closest("[data-test-id='DisplayOptimizedFormControl'], [data-test-id='FormControl']") || button.parentElement;
    if (!container) {
      return;
    }

    const clearButtons = Array.from(container.querySelectorAll(
      "button[aria-label*='Remove'], button[aria-label*='remove'], button[aria-label*='Clear'], button[aria-label*='clear'], [data-test-id*='remove']"
    ));

    for (const clearButton of clearButtons) {
      clearButton.click();
      await humanPause(50, 100);
    }
  }

  async function selectDropdownValue(button, value, fieldNameHint = "") {
    if (!button) {
      debug("Dropdown target button missing", { target: value });
      return;
    }

    button.click();

    await humanPause(120, 240);

    const normalizedTarget = normalizeText(value);
    const options = Array.from(document.querySelectorAll("[data-option-text='true']"));

    const option = options.find((item) => normalizeText(item.textContent || "") === normalizedTarget)
      || options.find((item) => normalizeText(item.textContent || "").includes(normalizedTarget))
      || options.find((item) => normalizedTarget.includes(normalizeText(item.textContent || "")));

    if (option) {
      option.click();
      debug("Dropdown option selected", { target: value, optionText: option.textContent?.trim() || "" });
      await wait(80);
      await clickAway(button);
      await waitForSaveConfirmation(fieldNameHint || resolveFieldName(button));
      await humanPause();
    } else {
      debug("Dropdown option not found", { target: value });
      await clickAway(button);
      await waitForSaveConfirmation(fieldNameHint || resolveFieldName(button));
      await humanPause();
    }

    return element?.getAttribute?.("data-selenium-test") || element?.name || element?.tagName || "field";
  }

  function getToastTexts() {
    const selectors = [
      "[data-layer-for='FloatingAlertList']",
      "[role='status']",
      "[aria-live]",
      "[data-test-id*='Alert']",
      "[data-test-id*='alert']",
      "[class*='Alert']",
      "[class*='alert']",
      "[class*='Toast']",
      "[class*='toast']"
    ];

    const texts = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const txt = node.textContent?.replace(/\s+/g, " ").trim();
        if (txt) {
          texts.push(txt);
        }
      });
    });

    return texts;
  }

  function normalizeFieldNameForToast(fieldName) {
    return String(fieldName || "")
      .replace(/\s+/g, " ")
      .replace(/["“”„']/g, "")
      .replace(/[\*\:\s]+$/g, "")
      .trim()
      .toLowerCase();
  }

  function saveToastMatchesField(text, fieldName) {
    const normalizedText = normalizeFieldNameForToast(text);
    const normalizedFieldName = normalizeFieldNameForToast(fieldName);

    if (!normalizedFieldName) {
      return true;
    }

    return normalizedText.includes(`"${normalizedFieldName}"`)
      || normalizedText.includes(`'${normalizedFieldName}'`)
      || normalizedText.includes(normalizedFieldName);
  }

  async function waitForCondition(checkFn, timeoutMs = 6000, pollMs = 120) {
    const started = Date.now();
    while ((Date.now() - started) < timeoutMs) {
      if (checkFn()) {
        return true;
      }

      await wait(pollMs);
    }

    return false;
  }

  async function waitForSaveConfirmation(fieldName = "field") {
    const savingRegex = /saving changes|mentes folyamatban|mentés folyamatban/i;
    const savedRegex = /changes saved|saved|mentve|sikeresen mentve/i;
    const baselineToasts = getToastTexts();

    debug("Waiting for save confirmation", { fieldName });

    const seenSavingForField = await waitForCondition(() => {
      const current = getToastTexts();
      return current.some((text) => !baselineToasts.includes(text)
        && savingRegex.test(text)
        && saveToastMatchesField(text, fieldName));
    }, 6500, 120);

    const seenSavedForField = await waitForCondition(() => {
      const current = getToastTexts();
      return current.some((text) => !baselineToasts.includes(text)
        && savedRegex.test(text)
        && saveToastMatchesField(text, fieldName));
    }, seenSavingForField ? 9000 : 6500, 120);

    if (!seenSavedForField) {
      debug("Field-specific save banner not detected in time, using fallback delay", {
        fieldName,
        seenSavingForField
      });
      await humanPause(900, 1400);
      return;
    }

    debug(`"${fieldName}" changes saved`);
  }

  function inferBusinessMapping(activityText) {
    const normalized = normalizeText(activityText);

    for (const hint of BUSINESS_CATEGORY_HINTS) {
      const matchedNeedle = hint.needles.find((needle) => normalized.includes(normalizeText(needle)));
      if (matchedNeedle) {
        const mapping = {
          category: hint.category,
          activity: hint.activity
        };
        debug("Business category matched", { matchedNeedle, mapping });
        return mapping;
      }
    }

    const fallback = {
      category: "Services",
      activity: "Consulting"
    };
    debug("Business category fallback used", fallback);
    return fallback;
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
    await humanPause(80, 180);
  }

  function resolveFieldName(element) {
    const id = element?.getAttribute?.("id");
    if (id) {
      const label = document.querySelector(`label[for='${CSS.escape(id)}']`);
      const text = label?.textContent?.trim();
      if (text) {
        return text;
      }
    }

    const labelledBy = element?.getAttribute?.("aria-labelledby") || "";
    if (labelledBy) {
      const ids = labelledBy.split(/\s+/).filter(Boolean);
      for (const refId of ids) {
        const el = document.getElementById(refId);
        const txt = el?.textContent?.trim();
        if (txt) {
          return txt;
        }
      }
    }

    return element?.getAttribute?.("data-selenium-test") || element?.name || element?.tagName || "field";
  }

  function getToastTexts() {
    const selectors = [
      "[data-layer-for='FloatingAlertList']",
      "[role='status']",
      "[aria-live]",
      "[data-test-id*='Alert']",
      "[data-test-id*='alert']",
      "[class*='Alert']",
      "[class*='alert']",
      "[class*='Toast']",
      "[class*='toast']"
    ];

    const texts = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => {
        const txt = node.textContent?.replace(/\s+/g, " ").trim();
        if (txt) {
          texts.push(txt);
        }
      });
    });

    return texts;
  }

  function normalizeFieldNameForToast(fieldName) {
    return String(fieldName || "")
      .replace(/\s+/g, " ")
      .replace(/["“”„']/g, "")
      .replace(/[\*\:\s]+$/g, "")
      .trim()
      .toLowerCase();
  }

  function saveToastMatchesField(text, fieldName) {
    const normalizedText = normalizeFieldNameForToast(text);
    const normalizedFieldName = normalizeFieldNameForToast(fieldName);

    if (!normalizedFieldName) {
      return true;
    }

    return normalizedText.includes(`"${normalizedFieldName}"`)
      || normalizedText.includes(`'${normalizedFieldName}'`)
      || normalizedText.includes(normalizedFieldName);
  }

  async function waitForCondition(checkFn, timeoutMs = 6000, pollMs = 120) {
    const started = Date.now();
    while ((Date.now() - started) < timeoutMs) {
      if (checkFn()) {
        return true;
      }

      await wait(pollMs);
    }

    return false;
  }

  async function waitForSaveConfirmation(fieldName = "field") {
    const savingRegex = /saving changes|mentes folyamatban|mentés folyamatban/i;
    const savedRegex = /changes saved|saved|mentve|sikeresen mentve/i;
    const baselineToasts = getToastTexts();

    debug("Waiting for save confirmation", { fieldName });

    const seenSavingForField = await waitForCondition(() => {
      const current = getToastTexts();
      return current.some((text) => !baselineToasts.includes(text)
        && savingRegex.test(text)
        && saveToastMatchesField(text, fieldName));
    }, 6500, 120);

    const seenSavedForField = await waitForCondition(() => {
      const current = getToastTexts();
      return current.some((text) => !baselineToasts.includes(text)
        && savedRegex.test(text)
        && saveToastMatchesField(text, fieldName));
    }, seenSavingForField ? 9000 : 6500, 120);

    if (!seenSavedForField) {
      debug("Field-specific save banner not detected in time, using fallback delay", {
        fieldName,
        seenSavingForField
      });
      await humanPause(900, 1400);
      return;
    }

    debug(`"${fieldName}" changes saved`);
  }

  function inferBusinessMapping(activityText) {
    const normalized = normalizeText(activityText);

    for (const hint of BUSINESS_CATEGORY_HINTS) {
      const matchedNeedle = hint.needles.find((needle) => normalized.includes(normalizeText(needle)));
      if (matchedNeedle) {
        const mapping = {
          category: hint.category,
          activity: hint.activity
        };
        debug("Business category matched", { matchedNeedle, mapping });
        return mapping;
      }
    }

    const fallback = {
      category: "Services",
      activity: "Consulting"
    };
    debug("Business category fallback used", fallback);
    return fallback;
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

    const cleaned = raw
      .replace(/\(.*?\)/g, "")
      .replace(/^\d+\)\s*/, "")
      .replace(/^Név:\s*/i, "")
      .trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: "" };
    }

    // Hungarian source names are commonly in "LastName FirstName" order.
    return {
      firstName: parts.slice(1).join(" "),
      lastName: parts[0]
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

  async function humanPause(min = HUMAN_DELAY_MIN_MS, max = HUMAN_DELAY_MAX_MS) {
    const jitter = Math.floor(Math.random() * Math.max(1, (max - min + 1)));
    const ms = min + jitter;
    await wait(ms);
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
