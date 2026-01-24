-- Migration: Update business_images for Cloudinary
-- Schimbă coloana image_filename în image_url pentru a stoca URL-uri Cloudinary

-- Adaugă coloana nouă (dacă nu există)
ALTER TABLE business_images 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Copiază datele din image_filename în image_url (pentru backward compatibility)
-- Aceasta va trebui rulată manual dacă ai imagini existente
-- UPDATE business_images SET image_url = '/uploads/businesses/' || image_filename WHERE image_filename IS NOT NULL AND image_url IS NULL;

-- Notă: Nu ștergem image_filename deocamdată pentru backward compatibility
