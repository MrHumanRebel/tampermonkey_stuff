// ==UserScript==
// @name         HubSpot – Opten JSON Autofill
// @namespace    https://teya.local/
// @version      0.1.0
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
    { match: /Registration Number|Company Registration|Registry Number/i, key: "Cégjegyzékszám / Nyilvántartási szám" },
    { match: /Email/i, key: "Email" },
    { match: /Phone/i, key: "Telefon" },
    { match: /Business Category/i, key: "Tevékenységi köre(i)" },
    { match: /Business Activity/i, key: "Tevékenységi köre(i)" },
    { match: /Annual Revenue|Net Revenue|Értékesítés nettó árbevétele/i, key: "Értékesítés nettó árbevétele" },
    { match: /Monthly Card Revenue|Becsült kártyás nettó havi árbevétele/i, key: "Becsült kártyás nettó havi árbevétele" },
    { match: /MCC Average Basket|MCC átlagos kosárérték/i, key: "MCC átlagos kosárérték (HUF)" }
  ];

  const CONTACT_LABELS = {
    firstName: /First Name/i,
    lastName: /Last Name/i
  };

  const STYLE = `
    .${BUTTON_CLASS} {
      margin-right: 8px;
      padding: 6px 12px;
      border-radius: 4px;
      border: 1px solid #ff4800;
      background: #ff4800;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
      line-height: 1.2;
    }
    .${BUTTON_CLASS}:hover {
      filter: brightness(0.95);
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
    const closeButtons = document.querySelectorAll(
      "button[aria-label='Close'], button[aria-label='Close panel'], button[data-test-id*='close'], button[data-test-id*='Close']"
    );

    closeButtons.forEach((closeButton) => {
      const parent = closeButton.parentElement;
      if (!parent || parent.querySelector(`.${BUTTON_CLASS}`)) {
        return;
      }

      const fillButton = document.createElement("button");
      fillButton.type = "button";
      fillButton.className = BUTTON_CLASS;
      fillButton.textContent = "Fill JSON";
      fillButton.addEventListener("click", () => handleFillClick(closeButton));

      parent.insertBefore(fillButton, closeButton);
    });
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
    return closeButton.closest("form") || closeButton.closest("[role='dialog']") || document.querySelector("form");
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
          ${needsOfficer ? buildSelect("Cégjegyzésre jogosult", "teya-officer", officers) : ""}
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
    const fields = Array.from(formRoot.querySelectorAll("label"));
    const officerName = selection?.officer || data["Cégjegyzésre jogosultak"] || "";
    const contact = splitName(officerName);

    for (const label of fields) {
      const labelText = label.textContent.trim();
      if (!labelText) {
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

      const rule = LABEL_RULES.find((entry) => entry.match.test(labelText));
      if (rule) {
        const value = data[rule.key];
        if (value) {
          await fillFieldForLabel(label, value);
        }
      }
    }
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

    const textInput = container.querySelector("input[type='text'], textarea");
    if (textInput) {
      setInputValue(textInput, value);
      return;
    }

    const dropdownButton = container.querySelector("button[data-dropdown]");
    if (dropdownButton) {
      await selectDropdownValue(dropdownButton, value);
    }
  }

  function setInputValue(input, value) {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function selectDropdownValue(button, value) {
    button.click();

    await wait(100);

    const options = Array.from(document.querySelectorAll("[data-option-text='true']"));
    const option = options.find((item) => item.textContent.trim().toLowerCase() === value.toLowerCase())
      || options.find((item) => item.textContent.trim().toLowerCase().includes(value.toLowerCase()));

    if (option) {
      option.click();
    }
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
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
