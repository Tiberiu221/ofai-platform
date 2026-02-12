-- Migration 017: Replace expired Pixabay logo URLs with DiceBear initials
-- Pixabay temporary download URLs have expired (return 400 Bad Request)
-- DiceBear generates avatars based on business name (free, no API key, CDN-cached)

-- Replace all Pixabay URLs with DiceBear initials (PNG, 256px, orange bg)
UPDATE businesses
SET logo_url = 'https://api.dicebear.com/7.x/initials/png?seed='
  || replace(replace(replace(name, ' ', '%20'), '&', '%26'), '''', '%27')
  || '&size=256&backgroundColor=f97316&textColor=ffffff'
WHERE logo_url LIKE '%pixabay.com%';
