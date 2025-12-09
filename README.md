# tampermonkey_stuff

Small collection of my personal Tampermonkey userscripts.

> ⚠️ These scripts are **unofficial** and come with **no warranty**.  
> I’m not affiliated with OpenAI, BunkerWeb or any of the services they target.  
> Use at your own risk.

---

## Contents

- [Scripts](#scripts)
  - [chatgpt_pdf.js](#chatgpt_pdfjs)
  - [bunkerweb_debloat.js](#bunkerweb_debloatjs)
- [Installation](#installation)
- [Development](#development)
- [License](#license)

---

## Scripts

### `chatgpt_pdf.js`

**ChatGPT Full-Page + Single-Message PDF Export Helper**

Adds convenient PDF/print helpers to `chatgpt.com` without breaking the layout.

**Features**

- 🧾 **Per-message “PDF” button**  
  - A `PDF` pill appears next to the `More actions` (…) button on assistant messages.  
  - Prints **only that single turn** into a clean PDF:
    - Hides copy/share buttons, model-switcher, and extra UI noise.
    - Keeps code blocks and KaTeX readable.
    - Expands scrollable containers so long messages don’t get cut.

- 📄 **Full page PDF button in the header**  
  - Adds a `Full page PDF` button next to ChatGPT’s “Share” button.  
  - Calls `window.print()` but with custom CSS so the whole chat is printable:
    - Removes fixed viewport / `h-screen` styles.
    - Disables transforms that could distort the PDF.
    - Forces readable fonts and line-wrapping.

- 🖨️ **Print-friendly CSS**  
  - Ensures long conversations are not squeezed into a single viewport-sized page.
  - Hides most action buttons during printing.
  - Leaves KaTeX rendering untouched.

---

### `bunkerweb_debloat.js`

**BunkerWeb UI “debloat” helper**

Personal userscript for simplifying / decluttering the BunkerWeb web UI.

**Ideas / goals**

- Hide elements that are not needed in daily operation (marketing / promo / extra chrome).
- Make the important controls (rules, logs, security settings, etc.) more prominent.
- Reduce scrolling and visual noise when managing BunkerWeb instances.

> Note: This script is tailored to **my own BunkerWeb setup** and UI preferences.  
> It might need tweaks for other versions, themes or screen sizes.

---

## Installation

You need a userscript manager such as **Tampermonkey** (or compatible):

1. Install Tampermonkey in your browser (Chrome / Edge / Brave / Firefox, etc.).
2. Open the script you want in this repo:
   - `chatgpt_pdf.js`
   - `bunkerweb_debloat.js`
3. Click the **Raw** button in GitHub.
4. Tampermonkey should offer to install the script automatically.  
   If not:
   - Create a **New script** in Tampermonkey.
   - Copy & paste the contents of the `.js` file.
   - Save.

The `@match` rules in each script define which sites they run on.

---

## Development

- Simple single-file scripts, no build step.
- To hack on them:
  1. Clone the repo.
  2. Import the file into Tampermonkey as a local script.
  3. Edit in your editor and copy/paste changes back, or use Tampermonkey’s built-in editor.

Pull requests / ideas are welcome, but the repo mainly exists for my own setup.

---

## License

Released under the **MIT License** – see [`LICENSE`](./LICENSE) for details.
