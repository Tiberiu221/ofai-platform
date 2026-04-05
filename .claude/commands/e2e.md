---
description: Run Playwright E2E tests on the OFAI web app. Opens browser, navigates all pages, verifies everything works. Run at end of day or after major changes.
---

# E2E Tests — Playwright

Run the full Playwright E2E test suite:

```bash
cd appredueri_backend && npm run test:e2e
```

After tests complete, report results:
- Total passed / failed / skipped
- If any failures: read the screenshot from `test-results/` folder and explain what broke
- If all pass: confirm with ✅

If the user wants to see the browser while tests run:
```bash
cd appredueri_backend && npm run test:e2e:headed
```

If tests fail due to rate limiting ("Prea multe cereri"), kill any old Node process and retry:
```bash
taskkill //f //im node.exe 2>/dev/null
npm run test:e2e
```
