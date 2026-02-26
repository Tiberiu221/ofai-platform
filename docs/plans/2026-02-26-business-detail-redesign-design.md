# Business Detail Page Redesign — Design Document

## Problem
After the offer detail redesign (fee56bd), the business detail page looks inconsistent — cramped sections, no card wrapping, old 2-column grid layout. Needs the same "Editorial Magazine" treatment.

## Design Decisions

- **Layout:** Full-width vertical single column, max-width 900px (NOT 2-col grid)
- **Hero:** Keep 260px cover, smoother gradient
- **Cards:** `.detail-card` for ALL sections (reuse from offer detail)
- **Section order:** Profil → Oferte → Locații → Sumar AI → Despre → Galerie → Recenzii
- **Profile:** Left-aligned premium — avatar 80px left, info right, compact rating
- **Rating breakdown:** Moved from profile to Reviews section
- **Gallery:** Horizontal scroll strip (NOT 2x2 grid)
- **Flutter:** Mirror changes (spacing, cards, breakdown move)

## Section Details

### 1. Layout + Hero
- Single column, `max-width: 900px`, margin auto
- Padding: 48px desktop, 20px mobile; 48px between sections
- Hero: full-bleed 260px, gradient `rgba(0,0,0,0) → rgba(9,9,11,0.9)`

### 2. Profile (sub hero, overlap -40px)
- Avatar 80px left, border 3px solid bg-primary
- Name (DM Serif Display, 1.75rem) + verified badge (glow)
- Rating compact: stars + "4.7 · 23 recenzii"
- Badges: category + city
- Actions: Follow (accent), Share (ghost), Call/Website/Navigate (icons)

### 3. Oferte Active (`.detail-card`)
- Header with count badge, grid of offer cards
- Pinch card inline if no offers

### 4. Locații (`.detail-card`)
- Header with count badge, reuse `.booking-card`

### 5. Sumar AI (`.detail-card`)
- "Ce spun clienții", accent tint bg

### 6. Despre (`.detail-card`)
- Description text, skip if empty

### 7. Galerie (`.detail-card`)
- Horizontal scroll strip, 200x150px images, hover scale
- Click → lightbox

### 8. Recenzii (`.detail-card`)
- Header + "Scrie o recenzie" btn
- Rating breakdown bars (moved here)
- Review cards + form
