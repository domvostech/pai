# Expense Fields Expansion Design

## Goal

Add VAT breakdown fields and cost centre to support German production company expense reports. The current single `amount` field becomes `amount_net` (netto); three new fields capture brutto subtotals per VAT rate; `cost_center` moves to the project level.

---

## Section 1: Database Schema

### `expenses` table

- Rename `amount` → `amount_net` (netto, required, primary figure)
- Add `amount_gross` — nullable numeric, total brutto
- Add `amount_19` — nullable numeric, brutto subtotal at 19% VAT
- Add `amount_7` — nullable numeric, brutto subtotal at 7% VAT
- Add `amount_0` — nullable numeric, brutto subtotal at 0% (VAT-exempt)

All new fields are nullable. A receipt may show only net, only gross, or a full breakdown — all are valid.

No migration constraints on old data — not in production.

### `projects` table

- Add `cost_center` — nullable text, internal accounting code assigned at project level

---

## Section 2: Form UX

The ExpenseForm layout (add and edit) changes:

- **Amount (net)** — existing required field, relabeled "Amount (net)" with `€` prefix. Primary field.
- **Gross total** — optional numeric input below net, labeled "Gross total (€)".
- **VAT breakdown** — three optional numeric inputs in a row: `19%`, `7%`, `0%`. Group labeled "VAT breakdown — gross amounts (optional)". Independent; do not need to sum to gross total.
- All new fields appear below the existing amount/date/vendor/category block. Existing form flow unchanged for users who skip them.

Cost centre is not on the expense form — it is on the project detail/edit form as a plain text input labeled "Cost centre".

---

## Section 3: OCR

The OCR prompt is updated to extract from German receipts:

- `amount_net` — netto total
- `amount_gross` — brutto total
- `amount_19` / `amount_7` / `amount_0` — brutto subtotals per VAT rate, if itemised

`cost_center` is not extracted (internal code, not printed on receipts).

For receipts showing only a gross total, OCR returns `amount_gross` and leaves breakdown fields null. For receipts with full Netto/MwSt/Brutto itemisation, OCR populates all fields. Single confidence score retained.

---

## Section 4: Display & Reporting

- **Expense list** — shows `amount_net` as the primary figure (same column position as current `amount`). No additional columns added.
- **Expense detail / edit** — all new VAT fields visible and editable.
- **PDF export** — "Amount" column renamed to "Net". Optional columns (Gross, 19%, 7%, 0%) included only if at least one expense in the report has a value for that field. Cost centre printed as a header field on the report, not a per-row column.
- **Project detail** — cost centre shown and editable.
