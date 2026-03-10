-- Rename amount to amount_net on expenses
ALTER TABLE expenses RENAME COLUMN amount TO amount_net;

-- Add VAT breakdown columns (all nullable)
ALTER TABLE expenses ADD COLUMN amount_gross numeric;
ALTER TABLE expenses ADD COLUMN amount_19 numeric;
ALTER TABLE expenses ADD COLUMN amount_7 numeric;
ALTER TABLE expenses ADD COLUMN amount_0 numeric;

-- Add cost_center to projects
ALTER TABLE projects ADD COLUMN cost_center text;
