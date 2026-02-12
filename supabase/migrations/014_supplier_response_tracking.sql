-- Supplier Response Tracking Enhancement
-- Adds quote_request_id column to email_supplier_interactions for better linking

-- Add quote_request_id column to email_supplier_interactions
ALTER TABLE email_supplier_interactions
ADD COLUMN IF NOT EXISTS quote_request_id UUID REFERENCES quote_requests(id) ON DELETE SET NULL;

-- Add index for quote_request_id lookups
CREATE INDEX IF NOT EXISTS idx_email_supplier_interactions_quote_request_id 
ON email_supplier_interactions(quote_request_id);

-- Add metadata column to quote_requests if not exists (for supplier responses tracking)
ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index on metadata for supplier response queries
CREATE INDEX IF NOT EXISTS idx_quote_requests_metadata_gin 
ON quote_requests USING gin(metadata);
