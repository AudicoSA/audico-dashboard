-- Products Table Migration
-- This table stores product catalog with cost and pricing information

-- ============================================
-- PRODUCTS: Product catalog
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT UNIQUE,
    category TEXT,
    price DECIMAL(10, 2) NOT NULL,
    cost DECIMAL(10, 2),
    currency TEXT DEFAULT 'ZAR',
    stock_quantity INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for products
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON products FOR ALL USING (true);

-- Updated_at trigger for products
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample products for testing
INSERT INTO products (name, description, sku, category, price, cost, stock_quantity) VALUES
    ('Sonos Arc', 'Premium Smart Soundbar', 'SONOS-ARC-001', 'Audio', 16999.00, 12000.00, 15),
    ('Sonos Beam Gen 2', 'Compact Smart Soundbar', 'SONOS-BEAM2-001', 'Audio', 8999.00, 6500.00, 25),
    ('Sonos One SL', 'Compact Smart Speaker', 'SONOS-ONESL-001', 'Audio', 4999.00, 3500.00, 40),
    ('Sonos Sub', 'Wireless Subwoofer', 'SONOS-SUB-001', 'Audio', 14999.00, 10500.00, 10),
    ('Sonos Move', 'Portable Smart Speaker', 'SONOS-MOVE-001', 'Audio', 8999.00, 6500.00, 20),
    ('Google Nest Hub Max', 'Smart Display', 'GOOGLE-HUBMAX-001', 'Smart Home', 4299.00, 3000.00, 30),
    ('Philips Hue Starter Kit', 'Smart Lighting System', 'PHILIPS-HUE-001', 'Smart Home', 2999.00, 2100.00, 50),
    ('Ring Video Doorbell', 'Smart Doorbell', 'RING-VDB-001', 'Security', 2499.00, 1750.00, 35),
    ('TP-Link Deco M5', 'Mesh WiFi System', 'TPLINK-DECOM5-001', 'Networking', 3499.00, 2500.00, 45),
    ('Samsung SmartThings Hub', 'Smart Home Hub', 'SAMSUNG-STHUB-001', 'Smart Home', 1999.00, 1400.00, 60)
ON CONFLICT (sku) DO NOTHING;
