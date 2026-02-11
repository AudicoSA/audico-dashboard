-- Supplier Contacts Management Enhancements
-- Adds columns needed for the supplier contacts management UI

-- Add tags and is_active columns to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add custom_markup_percentage to supplier_products for manual overrides
ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS custom_markup_percentage NUMERIC(5, 2);

-- Create index for tags (using GIN for array searches)
CREATE INDEX IF NOT EXISTS idx_suppliers_tags ON suppliers USING GIN(tags);

-- Create index for is_active
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active) WHERE is_active = true;

-- Create index for custom_markup on supplier_products
CREATE INDEX IF NOT EXISTS idx_supplier_products_custom_markup ON supplier_products(custom_markup_percentage) WHERE custom_markup_percentage IS NOT NULL;

-- Add comments
COMMENT ON COLUMN suppliers.tags IS 'Custom tags for categorizing suppliers (e.g., Premium, Preferred, Fast Shipping)';
COMMENT ON COLUMN suppliers.is_active IS 'Whether the supplier is currently active or archived';
COMMENT ON COLUMN supplier_products.custom_markup_percentage IS 'Manual markup override that takes precedence over learned avg_markup_percentage';
