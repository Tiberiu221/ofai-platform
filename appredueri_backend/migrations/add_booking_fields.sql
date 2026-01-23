-- =============================================
-- MIGRARE: Adaugă câmpuri de booking
-- =============================================

-- 1. Booking pentru BUSINESSES (pentru business-uri cu o singură locație)
ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS booking_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_whatsapp VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_url TEXT,
ADD COLUMN IF NOT EXISTS booking_instructions TEXT;

-- 2. Booking pentru OFFERS (pentru rezervări specifice per ofertă)
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS booking_type VARCHAR(20) DEFAULT 'inherit',
ADD COLUMN IF NOT EXISTS booking_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_whatsapp VARCHAR(50),
ADD COLUMN IF NOT EXISTS booking_url TEXT,
ADD COLUMN IF NOT EXISTS booking_instructions TEXT;

-- =============================================
-- EXPLICAȚII:
-- =============================================

-- businesses.booking_type poate fi:
--   'none' = fără rezervări (default)
--   'phone' = rezervare telefonică
--   'whatsapp' = rezervare WhatsApp  
--   'link' = rezervare prin URL

-- offers.booking_type poate fi:
--   'inherit' = folosește setările de la business (default)
--   'none' = fără rezervări pentru această ofertă
--   'phone' = rezervare telefonică specifică
--   'whatsapp' = rezervare WhatsApp specifică
--   'link' = rezervare prin URL specific

-- LOGICA în aplicație:
-- 1. Când se afișează o ofertă, se verifică mai întâi booking_type de pe ofertă
-- 2. Dacă este 'inherit', se folosesc setările de la business
-- 3. Altfel, se folosesc setările specifice ofertei
