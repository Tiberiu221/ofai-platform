-- Adaugă câmpuri de booking pe tabelul businesses
-- Acestea se folosesc pentru business-uri cu o singură locație
-- sau ca fallback când nu există locații definite

ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS booking_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_whatsapp VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_url TEXT,
ADD COLUMN IF NOT EXISTS booking_instructions TEXT;

-- Comentariu pentru claritate
COMMENT ON COLUMN businesses.booking_type IS 'Tipul de rezervare: none, phone, whatsapp, link';
COMMENT ON COLUMN businesses.booking_phone IS 'Telefon pentru rezervări (dacă booking_type = phone)';
COMMENT ON COLUMN businesses.booking_whatsapp IS 'Număr WhatsApp pentru rezervări (dacă booking_type = whatsapp)';
COMMENT ON COLUMN businesses.booking_url IS 'URL pentru rezervări online (dacă booking_type = link)';
COMMENT ON COLUMN businesses.booking_instructions IS 'Instrucțiuni suplimentare pentru rezervare';
