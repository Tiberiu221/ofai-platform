# R09 — Fix manage.ejs Missing Closing `</div>` for #tab-info

> **Severitate:** CRITICAL (BLOCKING)
> **Fisier:** `appredueri_backend/src/views/public/portal/manage.ejs`, linia ~945-950
> **Impact:** Tab-ul #tab-info nu este inchis inainte de #tab-oferte. Toate tab-urile urmatoare sunt nested in #tab-info, ceea ce face **tot tab switching-ul sa nu functioneze**.

---

## Problema

Structura actuala (simplificata):

```
Linia 664:  <div class="tab-panel active" id="tab-info">     ← DESCHIDE tab-info
Linia 665:    <form id="business-info-form">
              ...
Linia 829:    </form>
Linia 832:    <div class="glass-card" id="gallery-section">
              ...
Linia 926:    </div>                                          ← Inchide gallery-section
Linia 928:    <% if (tier.plan.has_competitor_blocking) { %>
              ...competitor blocking toggle...
Linia 945:    <% } %>
                                                               ← LIPSA: </div> pentru #tab-info!
Linia 950:  <div class="tab-panel" id="tab-oferte">           ← DESCHIDE tab-oferte
              ...
```

Fara `</div>` inchis, tab-oferte, tab-recenzii, tab-statistici, tab-support si tab-subscription sunt **toate** nested in `#tab-info`. CSS-ul `.tab-panel { display: none; }` si `.tab-panel.active { display: block; }` functioneaza doar pe nivel de tab panel direct — un tab panel nested intr-un alt tab panel ascuns NU se va afisa niciodata.

---

## Fix

Adauga `</div>` dupa sectiunea competitor blocking si inainte de comentariul TAB 2:

### Gaseste (linia ~945-950):
```ejs
      <% } %>

    <!-- ═══════════════════════════════════════
         TAB 2: OFERTE
         ═══════════════════════════════════════ -->
    <div class="tab-panel" id="tab-oferte">
```

### Inlocuieste cu:
```ejs
      <% } %>

    </div>
    <!-- /#tab-info -->

    <!-- ═══════════════════════════════════════
         TAB 2: OFERTE
         ═══════════════════════════════════════ -->
    <div class="tab-panel" id="tab-oferte">
```

### Verificare nesting

Dupa fix, structura corecta este:
```
<div id="tab-info">
  <form>...</form>
  <div class="glass-card" id="gallery-section">...</div>
  <div class="glass-card">...competitor blocking...</div>    (conditional)
</div>                                                         ← NOU
<div id="tab-oferte">...</div>
<div id="tab-recenzii">...</div>
<div id="tab-statistici">...</div>
<div id="tab-support">...</div>
<div id="tab-subscription">...</div>
```

---

## Verificare

- [ ] Deschide manage.ejs in browser: `/portal/:businessId/manage`
- [ ] Click pe tab-ul "Oferte" → se afiseaza corect (nu ramane gol)
- [ ] Click pe tab-ul "Recenzii" → se afiseaza corect
- [ ] Click pe tab-ul "Statistici" → se afiseaza corect
- [ ] Click pe tab-ul "Suport" → se afiseaza corect
- [ ] Click pe tab-ul "Abonament" → se afiseaza corect
- [ ] Tab-ul "Info" → competitor blocking toggle vizibil (daca business-ul e Premium)
- [ ] Hash navigation: `/portal/:businessId/manage#tab-oferte` → tab-ul corect activ
