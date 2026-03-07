# Design: Mutare Insigne din /cont → /setari + Galerie Completă

**Data:** 2026-03-07

---

## Problema

1. Secțiunea "Insigne câștigate" din /cont ocupă spațiu pe o pagină care ar trebui să fie doar profil + navigare.
2. Utilizatorii nu știu ce alte insigne există (nu au vizibilitate asupra celor necâștigate).
3. Glow-ul de selecție aplicat pe dreptunghiul `.badge-item` (background) e vizual neplăcut — trebuie doar pe cerc.

## Soluție

### 1. /cont (account.ejs) — Eliminare secțiune insigne

Scoatem complet blocul `badges-card` (liniile 75-188 actuale): HTML + script-ul inline de scroll/selecție.

Pagina rămâne: profil card → menu items → logout.

### 2. /setari (setari.ejs) — Secțiune nouă "Insignele mele"

Adăugăm deasupra secțiunii "Schimbă parola" o nouă secțiune cu:

- **Titlu:** "Insignele mele" + count badge câștigate (ex: `3/7`)
- **Grid/strip** cu TOATE badge_definitions din DB
- **Badge-uri câștigate:** colorate normal, clickabile pentru selectare display badge
  - Opțiunea "Niciuna" (X icon) rămâne prima
  - Badge-ul selectat are glow doar pe cerc (nu pe dreptunghi)
- **Badge-uri necâștigate:** greyed out
  - `opacity: 0.35` + `filter: grayscale(1)` pe icon
  - `cursor: default` (nu clickabil)
  - Tooltip cu descrierea + cum se obține
- **Subtitlu:** "Selectează pentru recenzii" (ca acum)

### 3. CSS (enhancements.css) — Fix glow dreptunghi

```css
/* ÎNAINTE */
.badge-item.badge-selected {
  background: var(--accent-muted);  /* ← dreptunghi glow */
}

/* DUPĂ */
.badge-item.badge-selected {
  background: transparent;  /* ← fără glow pe dreptunghi */
}
```

Glow-ul de pe `.badge-icon` rămâne intact (box-shadow pe cerc).

Clasă nouă:
```css
.badge-locked {
  opacity: 0.35;
  filter: grayscale(1);
  cursor: default;
  pointer-events: none;
}
.badge-locked .badge-icon {
  border-style: dashed;
}
```

### 4. Backend (web.js /setari route)

Adăugăm `getAllBadgeDefinitions()` și `getUserBadges()` în datele trimise la render:

```javascript
const { getUserBadges, getAllBadgeDefinitions } = require("../services/badgeService");
const [userBadges, allBadges] = await Promise.all([
  getUserBadges(req.webUser.id).catch(() => []),
  getAllBadgeDefinitions().catch(() => []),
]);
// trimitem la render: userBadges, allBadges
```

### 5. /cont (web.js /cont route)

Eliminăm import-ul `getUserBadges` și query-ul din Promise.all — nu mai e necesar.

---

## Fișiere afectate

| Fișier | Acțiune |
|--------|---------|
| `views/public/account.ejs` | Scoatem badges-card + script |
| `views/public/setari.ejs` | Adăugăm secțiune insigne |
| `routes/web.js` (/setari) | Adăugăm userBadges + allBadges |
| `routes/web.js` (/cont) | Scoatem getUserBadges |
| `css/sections/enhancements.css` | Fix glow + clasă `.badge-locked` |

**Fișiere NOI:** niciunul
**Migrări:** niciuna

## Ce s-ar putea strica

| Risc | Severitate | Mitigare |
|------|-----------|----------|
| Script-ul de scroll/selectare copiat greșit | 🟡 MEDIUM | Copy-paste din account.ejs, testăm cu preview |
| `getAllBadgeDefinitions` returnează badges fără `id` | 🟢 LOW | Funcția selectează din badge_definitions — adăugăm `id` în SELECT |
| Badge-uri locked apar clickabile | 🟢 LOW | `pointer-events: none` pe `.badge-locked` |
