-- Adaugă câmpuri de booking pe tabelul offers
-- Permite configurarea rezervărilor specific pentru fiecare ofertă

ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) DEFAULT 'inherit',
ADD COLUMN IF NOT EXISTS booking_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_whatsapp VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_url TEXT,
ADD COLUMN IF NOT EXISTS booking_instructions TEXT;

-- booking_type poate fi:
-- 'inherit' = folosește setările de booking ale business-ului (default)
-- 'none' = fără rezervări pentru această ofertă
-- 'phone' = rezervare telefonică
-- 'whatsapp' = rezervare WhatsApp
-- 'link' = rezervare prin link

COMMENT ON COLUMN offers.booking_type IS 'Tipul de rezervare: inherit (de la business), none, phone, whatsapp, link';
