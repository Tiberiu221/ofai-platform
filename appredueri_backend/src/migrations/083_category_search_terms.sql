-- Migration 083: Category search synonyms (internal SEO)
-- Enables searching "dentist" to find "Stomatologie", "cabana" to find "Retreat", etc.
-- Admin-editable via /admin/categories

ALTER TABLE categories ADD COLUMN IF NOT EXISTS search_terms TEXT;

UPDATE categories SET search_terms = CASE name
  WHEN 'Clinica' THEN 'doctor medic consultatie cabinet medical policlinica pediatru ginecolog dermatolog oftalmolog ORL recuperare fizioterapie'
  WHEN 'Frizerie' THEN 'coafor frizor barbier barber tuns tunsoare par breton vopsit coafura stilist'
  WHEN 'Beauty' THEN 'cosmetica machiaj makeup salon infrumusetare epilare tratament facial botox gene sprancene manichiura pedichiura'
  WHEN 'Auto' THEN 'mecanic service ITP vulcanizare spalatorie masina reparatii ulei anvelope detailing polish caroserie'
  WHEN 'Cafenea' THEN 'cafea coffee ceai ceainarie patiserie croissant brunch latte espresso cappuccino desert prajitura tort'
  WHEN 'Fitness' THEN 'sala antrenament gym sport crossfit yoga pilates aerobic personal trainer culturism cardio'
  WHEN 'Spa & Wellness' THEN 'masaj sauna piscina jacuzzi relaxare hamam tratament corporal detox baie turca impachetari'
  WHEN 'Veterinar' THEN 'caine pisica animal vet vaccin deparazitare sterilizare veterinara pet catel motanel papagal'
  WHEN 'Stomatologie' THEN 'dentist dinti implant aparat dentar ortodont albire carie plomba coroana proteza igienizare detartraj'
  WHEN 'Florarie' THEN 'flori buchete trandafiri aranjament floral livrare nunta botez eveniment coronita jerba'
  WHEN 'Curatatorie' THEN 'haine curatare chimica spalare detergent calcare rufe costume rochii perdele covoare'
  WHEN 'Foto & Video' THEN 'fotograf videograf nunta botez eveniment sedinta foto studio portret drone clip album'
  WHEN 'Magazine Online' THEN 'shop cumparaturi online comenzi livrare produse ecommerce magazin'
  WHEN 'Servicii' THEN 'reparatii instalator electrician zugrav curatenie menaj mutare transport constructor renovare'
  WHEN 'Retreat' THEN 'cabana pensiune cazare munte natura weekend getaway vila cottage airbnb hotel agroturism'
END;
