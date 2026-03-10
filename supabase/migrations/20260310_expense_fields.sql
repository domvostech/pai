-- BREAKING CHANGE: renames expenses.amount → expenses.amount_net.
-- All application code referencing expenses.amount must be updated in the same deploy.

BEGIN;

-- Rename primary amount field to amount_net (netto / net of VAT)
ALTER TABLE expenses RENAME COLUMN amount TO amount_net;

-- Add gross total and per-rate VAT breakdown columns (all nullable).
-- amount_19 / amount_7 / amount_0 hold gross subtotals for German VAT rates
-- (19% standard, 7% reduced, 0% exempt) as printed on German receipts.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_gross numeric;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_19 numeric;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_7 numeric;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_0 numeric;

-- Add internal accounting cost centre to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cost_center text;

COMMIT;
