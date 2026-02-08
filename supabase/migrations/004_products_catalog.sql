-- Products Catalog Migration
-- Creates products table for the social media agent RAG functionality

-- ============================================
-- PRODUCTS: Product catalog for RAG
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    brand TEXT,
    price DECIMAL(10, 2),
    features TEXT[],
    tags TEXT[],
    image_url TEXT,
    sku TEXT UNIQUE,
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for products
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_description ON products USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for authenticated users
CREATE POLICY "Allow all for authenticated" ON products FOR ALL USING (true);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Sample smart home products for testing
INSERT INTO products (name, description, category, brand, price, features, tags, sku, stock_quantity) VALUES
    ('Sonos One SL', 'Compact smart speaker with rich, room-filling sound. Perfect for multi-room audio setup.', 'Smart Speakers', 'Sonos', 3999.00, ARRAY['WiFi Connectivity', 'Multi-room Audio', 'Voice Assistant Compatible'], ARRAY['smart home', 'smart speakers', 'multiroom audio', 'home automation'], 'SONOS-ONE-SL', 15),
    ('Philips Hue White and Color Ambiance Starter Kit', 'Smart LED bulbs with 16 million colors. Control via app or voice. Create the perfect ambiance for any moment.', 'Smart Lighting', 'Philips', 2499.00, ARRAY['16 Million Colors', 'Voice Control', 'App Control', 'Schedules & Timers'], ARRAY['smart home', 'smart lighting', 'voice control', 'home automation'], 'PHILIPS-HUE-STARTER', 25),
    ('Google Nest Hub Max', 'Smart display with Google Assistant. Watch videos, make calls, control your smart home.', 'Smart Displays', 'Google', 4999.00, ARRAY['10-inch Display', 'Built-in Camera', 'Google Assistant', 'Smart Home Control'], ARRAY['smart home', 'voice control', 'smart display', 'home assistant'], 'NEST-HUB-MAX', 10),
    ('Ring Video Doorbell Pro 2', 'Advanced video doorbell with 3D motion detection and bird''s eye view. See who''s at your door from anywhere.', 'Smart Security', 'Ring', 5499.00, ARRAY['1536p HD Video', '3D Motion Detection', 'Two-Way Talk', 'Night Vision'], ARRAY['smart home', 'smart security', 'smart cameras', 'home automation'], 'RING-DOORBELL-PRO2', 8),
    ('ecobee SmartThermostat', 'Smart thermostat with built-in Alexa. Save up to 26% on heating and cooling costs.', 'Smart Climate', 'ecobee', 6999.00, ARRAY['Built-in Alexa', 'Room Sensors', 'Energy Savings', 'Voice Control'], ARRAY['smart home', 'smart thermostat', 'voice control', 'home automation'], 'ECOBEE-SMART-THERMO', 12),
    ('Samsung SmartThings Hub', 'Central hub for your smart home. Connect and control all your devices from one app.', 'Smart Hubs', 'Samsung', 1999.00, ARRAY['Multi-Protocol Support', 'App Control', 'Automation', 'Works with 200+ Devices'], ARRAY['smart home', 'home automation', 'IoT devices', 'connected home'], 'SAMSUNG-ST-HUB', 20),
    ('Yale Assure Lock SL', 'Keyless smart lock with touchscreen. Grant access from anywhere. Works with major smart home platforms.', 'Smart Locks', 'Yale', 3799.00, ARRAY['Touchscreen Keypad', 'App Control', 'Auto-Lock', 'Works with Alexa & Google'], ARRAY['smart home', 'smart locks', 'smart security', 'home automation'], 'YALE-ASSURE-SL', 6),
    ('TP-Link Kasa Smart WiFi Plug', 'Turn any appliance into a smart device. Control from anywhere. No hub required.', 'Smart Plugs', 'TP-Link', 299.00, ARRAY['No Hub Required', 'Voice Control', 'Scheduling', 'Away Mode'], ARRAY['smart home', 'smart devices', 'home automation', 'IoT devices'], 'TPLINK-KASA-PLUG', 50),
    ('Arlo Pro 4 Spotlight Camera', 'Wire-free security camera with 2K video and color night vision. Direct WiFi connection, no hub needed.', 'Smart Security', 'Arlo', 5999.00, ARRAY['2K Video', 'Color Night Vision', 'Wire-Free', '160° Field of View'], ARRAY['smart home', 'smart security', 'smart cameras', 'wireless home'], 'ARLO-PRO4-SPOT', 7),
    ('Lutron Caseta Wireless Dimmer Switch Kit', 'Smart dimmer switches that work with any bulb. Create the perfect lighting for any activity.', 'Smart Lighting', 'Lutron', 3299.00, ARRAY['Works with Any Bulb', 'Voice Control', 'Scheduling', 'Remote Control'], ARRAY['smart home', 'smart lighting', 'smart switches', 'home automation'], 'LUTRON-CASETA-KIT', 18),
    ('Amazon Echo Show 10', 'Smart display with motion that follows you. Video calls, entertainment, and smart home control.', 'Smart Displays', 'Amazon', 5499.00, ARRAY['10.1-inch Display', 'Motion Tracking', 'Built-in Alexa', '13MP Camera'], ARRAY['smart home', 'voice control', 'smart display', 'home assistant'], 'ECHO-SHOW-10', 9),
    ('Netatmo Smart Video Doorbell', 'Smart doorbell with person detection and no subscription fees. Works with existing chime.', 'Smart Security', 'Netatmo', 4599.00, ARRAY['No Subscription', 'Person Detection', 'Works with Chime', 'Local Storage'], ARRAY['smart home', 'smart security', 'smart cameras', 'home automation'], 'NETATMO-DOORBELL', 11)
ON CONFLICT (sku) DO NOTHING;
