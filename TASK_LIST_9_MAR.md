# Task List — 9 Martie 2026 (Duminica)

> Estimare: ~6h ore de lucru activ
> Prioritate: MUST DO prima, NICE TO DO daca ramane timp

---

## MUST DO (~6h)

### 1. Flutter `offer.business!` force-unwrap fix (1h)
**Fisier:** `ofai_flutter/lib/screens/offer/offer_detail_screen.dart`
**Problema:** 12+ instante de `offer.business!` fara null guard → crash daca business e null
**Fix:**
```dart
final biz = offer.business;
if (biz != null) {
  // ... tot codul care foloseste biz.id, biz.name, biz.logoUrl etc.
}
```
**Verificare:** `flutter analyze --no-pub` clean, test manual pe offer fara business

---

### 2. Audit #9 CRIT-uri ramase non-Stripe (2h)

**CRIT-05: `max_reveals` promo codes nu se verifica la reveal**
- Fisiere: `offers.js` (reveal endpoint) + `web.js` (web reveal)
- Fix: Inainte de reveal, verifica `SELECT max_reveals, (SELECT COUNT(*) FROM code_reveals WHERE offer_id = $1) as revealed_count`
- Daca `max_reveals IS NOT NULL AND revealed_count >= max_reveals` → 403

**CRIT-06: Web gallery upload hardcoded limit 8 vs tier**
- Fisier: `web.js` (gallery upload endpoint)
- Fix: Citeste limita din tier (getBusinessTier → checkLimit('gallery_images'))

**CRIT-09: XSS textarea breakout `review.response_text`**
- Fisier: `_tab-recenzii.ejs` (portal partial)
- Fix: Verifica ca `response_text` trece prin `<%=` (HTML-escaped), nu `<%-`

**CRIT-10: trackClick lipseste CSRF token**
- Fisier: `footer.ejs` (sau main.js trackClick)
- Fix: Adauga `X-CSRF-Token` header la trackClick fetch call

**CRIT-13: Promo code spinner blocat la null**
- Fisier: `offer_detail_screen.dart` (~linia 907)
- Fix: Handle null response gracefully, nu ramane in loading state

**CRIT-21: Deal nomination cron fara tranzactie**
- Fisier: `cronJobs.js` (~linia 244)
- Fix: Wrap deal nomination logic in BEGIN/COMMIT transaction

**CRIT-22: Migration 009 indexuri pe tabele inexistente**
- Fisier: `src/migrations/009_*.sql`
- Fix: Adauga `IF NOT EXISTS` sau muta indexurile dupa CREATE TABLE

---

### 3. Audit #9 HIGH-uri Flutter providers (2h)

**HIGH-12: `businesses_provider.dart` — shared cancel token**
- Problema: `fetch()` si `loadMore()` folosesc acelasi CancelToken → cancel pe fetch anuleaza si loadMore
- Fix: Separate CancelToken instances per operation

**HIGH-13: `auth_provider.dart` — `updateProfilePicture()` pierde `displayBadgeId`**
- Problema: Dupa upload, state-ul se rebuilduieste fara displayBadgeId
- Fix: Preserve displayBadgeId in state update

**HIGH-14: `search_suggest_provider.dart` — fara CancelToken**
- Problema: Rapid typing triggers many concurrent requests fara cancellation
- Fix: Adauga CancelToken, cancel previous on new request

**HIGH-15: fetch() in constructor cu autoDispose**
- Fisiere: `offers_provider.dart`, `businesses_provider.dart`
- Problema: Constructor calls fetch() but autoDispose recreates provider
- Fix: Move fetch() call to first listener or explicit init

**HIGH-16: `userLocationProvider` autoDispose + GPS re-fetch**
- Problema: GPS position re-fetched every time provider recreated
- Fix: Cache location or remove autoDispose

---

### 4. Review & test (1h)
- `flutter analyze --no-pub` — clean
- Start backend local: `cd appredueri_backend && node src/index.js` — no errors
- Test manual: login, view offer, reveal promo code, gallery upload
- Verify gallery upload respects tier limits

---

## NICE TO DO — Daca ramane timp

### 5. Audit #9 HIGH-uri backend (~1.5h)
- **HIGH-02:** Web login nu revoca refresh tokens existente → `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL` la login
- **HIGH-03:** Mobile reveal-code fara rate limiter → adauga `revealLimiter` pe `/offers/:id/promo-codes/reveal`
- **HIGH-05:** Promo code limit nu se verifica pe offer UPDATE → la `PUT /offers/:id`, verifica ca nr promo codes nu depaseste limita tier
- **HIGH-07:** Admin path traversal legacy image deletion → validez filename-ul (no `..`, no `/`)

### 6. Legacy migrations directory cleanup (~30min)
- Redenumeste fisierele din `appredueri_backend/migrations/` cu prefix `_LEGACY_`
- Sau sterge complet directorul (cu confirmare)
- Adauga README.md explicativ

### 7. Audit #9 MEDIUM cleanup (~1h)
- Flutter: inlocuieste `e.toString()` cu mesaje user-friendly in catch blocks
- Badge type fallthrough fix (badgeService.js)
- Missing diacritics in Romanian UI strings
- Responsive gaps pe mobile web

### 8. Stripe webhook implementation planning (~30min)
- NU implementare, doar plan detaliat
- Documenteaza flow-ul: checkout → webhook → create subscription → badge sync
- Identifica events necesare: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`

---

## Checklist Final
- [ ] Force-unwrap fix committed
- [ ] CRIT fixes committed
- [ ] Flutter HIGH fixes committed
- [ ] `flutter analyze` clean
- [ ] Backend starts without errors
- [ ] Push to main
