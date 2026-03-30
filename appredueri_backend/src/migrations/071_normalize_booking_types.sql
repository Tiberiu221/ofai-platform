-- Normalize booking_type values for consistency
-- 'link' → 'url' (scraping pipeline used 'link', templates check 'url')
-- 'NONE' → 'none' (case mismatch from legacy data)

UPDATE businesses SET booking_type = 'url' WHERE booking_type = 'link';
UPDATE business_locations SET booking_type = 'url' WHERE booking_type = 'link';
UPDATE business_locations SET booking_type = 'none' WHERE UPPER(booking_type) = 'NONE' AND booking_type != 'none';
