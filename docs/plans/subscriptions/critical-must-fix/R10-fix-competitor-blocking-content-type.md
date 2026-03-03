# R10 — Fix toggleCompetitorBlocking Content-Type Header

> **Severitate:** CRITICAL
> **Fisier:** `appredueri_backend/src/views/public/portal/manage.ejs`, linia ~2447
> **Impact:** PUT request-ul pentru competitor blocking nu trimite `Content-Type: application/json` → `express.json()` middleware nu parseaza body-ul → `req.body` este `undefined`/gol pe server → toggle-ul nu functioneaza.

---

## Problema

```js
window.toggleCompetitorBlocking = async function(btn) {
  var isOn = btn.classList.contains('on');
  var newValue = !isOn;

  try {
    var res = await apiFetch('/my-businesses/' + businessId + '/competitor-blocking', {
      method: 'PUT',
      body: JSON.stringify({ enabled: newValue }),
      // ← LIPSA: headers cu Content-Type
    });
```

Functia `apiFetch` (linia ~1562) adauga doar `X-CSRF-Token` la headers. **Nu** seteaza `Content-Type: application/json`.

Fara acest header, `express.json()` middleware ignora body-ul, si `req.body` pe server este `{}` sau `undefined`.

---

## Fix

### Varianta A (fix local — doar pentru toggleCompetitorBlocking):

```js
var res = await apiFetch('/my-businesses/' + businessId + '/competitor-blocking', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ enabled: newValue }),
});
```

### Varianta B (fix global — recomandabila — update apiFetch):

Modifica functia `apiFetch` (linia ~1562) sa adauge automat `Content-Type: application/json` cand body-ul este un string (JSON):

```js
function apiFetch(url, options) {
  var csrfToken = document.querySelector('meta[name="csrf-token"]');
  options = options || {};
  options.headers = options.headers || {};

  if (!(options.body instanceof FormData)) {
    if (typeof options.headers === 'object' && !Array.isArray(options.headers)) {
      options.headers['X-CSRF-Token'] = csrfToken ? csrfToken.getAttribute('content') : '';
      // Auto-set Content-Type for JSON bodies
      if (typeof options.body === 'string' && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
      }
    }
  } else {
    var newHeaders = new Headers(options.headers);
    newHeaders.set('X-CSRF-Token', csrfToken ? csrfToken.getAttribute('content') : '');
    options.headers = newHeaders;
  }

  return fetch(url, options).then(function(res) {
```

Varianta B este **recomandabila** deoarece:
1. Fixeaza toggleCompetitorBlocking
2. Fixeaza preventiv orice alt `apiFetch` cu JSON body care lipseste Content-Type
3. Nu afecteaza FormData uploads (care nu trebuie sa aiba Content-Type setat manual)

---

## Verificare alte apiFetch cu JSON body

Cauta in manage.ejs alte locuri unde `apiFetch` trimite JSON:
```bash
grep -n "JSON.stringify" src/views/public/portal/manage.ejs
```

Verifica ca toate au (sau vor avea dupa fix) `Content-Type: application/json`.

---

## Verificare

- [ ] Toggle competitor blocking ON → server primeste `{ enabled: true }` in req.body
- [ ] Toggle competitor blocking OFF → server primeste `{ enabled: false }` in req.body
- [ ] Toast success apare dupa toggle
- [ ] Cancel subscription (care trimite JSON) functioneaza corect
- [ ] Gallery upload (FormData) nu este afectat de fix-ul pe apiFetch
