-- Migration 074: Multi-platform booking methods
-- Replaces single booking_type column with a many-to-many table

CREATE TABLE IF NOT EXISTS business_booking_methods (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL,
  platform_label VARCHAR(100),
  value VARCHAR(500) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bbm_business ON business_booking_methods(business_id);

-- Backfill from existing booking data
-- Phone bookings
INSERT INTO business_booking_methods (business_id, platform, value, sort_order)
SELECT id, 'phone', COALESCE(booking_phone, phone), 0
FROM businesses
WHERE booking_type = 'phone' AND COALESCE(booking_phone, phone) IS NOT NULL
  AND COALESCE(booking_phone, phone) != ''
ON CONFLICT DO NOTHING;

-- WhatsApp bookings
INSERT INTO business_booking_methods (business_id, platform, value, sort_order)
SELECT id, 'whatsapp', COALESCE(booking_whatsapp, phone), 1
FROM businesses
WHERE booking_type = 'whatsapp' AND COALESCE(booking_whatsapp, phone) IS NOT NULL
  AND COALESCE(booking_whatsapp, phone) != ''
ON CONFLICT DO NOTHING;

-- URL bookings (detect platform from URL)
INSERT INTO business_booking_methods (business_id, platform, value, sort_order)
SELECT id,
  CASE
    WHEN booking_url ILIKE '%booksy.com%' THEN 'booksy'
    WHEN booking_url ILIKE '%fresha.com%' THEN 'fresha'
    WHEN booking_url ILIKE '%airbnb.%' THEN 'airbnb'
    WHEN booking_url ILIKE '%booking.com%' THEN 'booking_com'
    WHEN booking_url ILIKE '%calendly.com%' THEN 'calendly'
    WHEN booking_url ILIKE '%calendar.google%' OR booking_url ILIKE '%business.google%' THEN 'google'
    WHEN booking_url ILIKE '%treatwell.%' THEN 'treatwell'
    WHEN booking_url ILIKE '%planfy.com%' THEN 'planfy'
    WHEN booking_url ILIKE '%setmore.com%' THEN 'setmore'
    WHEN booking_url ILIKE '%simplybook.me%' THEN 'simplybook'
    ELSE 'website'
  END,
  COALESCE(booking_url, website), 2
FROM businesses
WHERE booking_type = 'url' AND COALESCE(booking_url, website) IS NOT NULL
  AND COALESCE(booking_url, website) != ''
ON CONFLICT DO NOTHING;
