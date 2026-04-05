---
description: Analyze current test coverage gaps and write missing tests. Targets both backend (Jest) and Flutter (flutter_test). Argument = area to focus on (e.g., "auth", "offers", "flutter models").
---

# Test Coverage Expander — OFAI

Analyze current test coverage and write tests for uncovered critical paths.

## Steps

### 1. Assess Current Coverage

**Backend:**
```bash
cd appredueri_backend && npm run test:coverage 2>&1 | tail -30
```

**Flutter:**
```bash
cd ofai_flutter && "C:/dev/flutter/bin/flutter.bat" test 2>&1 | tail -20
```

### 2. Identify Gaps

Read existing test files:
- Backend: `appredueri_backend/tests/*.test.js`
- Flutter: `ofai_flutter/test/*_test.dart`

Cross-reference with source files to find untested modules:
- Backend routes: `src/routes/*.js` (23 files, ~275 endpoints)
- Backend services: `src/services/*.js`
- Backend helpers: `src/helpers/*.js`
- Flutter models: `lib/models/*.dart` (13 models)
- Flutter providers: `lib/providers/*.dart` (20 providers)
- Flutter widgets: `lib/widgets/*.dart` (28 widgets)

### 3. Prioritize by Risk

| Priority | Area | Why |
|----------|------|-----|
| P0 | Auth routes (login, register, refresh) | Security critical |
| P0 | Billing routes (checkout, webhook) | Money critical |
| P0 | Tier enforcement (attachTier, requireFeature) | Access control |
| P1 | Offer CRUD | Core feature |
| P1 | Business CRUD | Core feature |
| P1 | Push notifications | User engagement |
| P2 | Favorites, reviews, collections | Secondary features |
| P2 | Flutter providers | State management |
| P3 | Admin routes | Internal only |
| P3 | Static data (categories, cities) | Rarely changes |

### 4. Write Tests

If argument provided (e.g., `/test-expand auth`), focus on that area.
If no argument, pick the highest-priority untested area.

**Backend test template:**
```javascript
const request = require('supertest');
const app = require('../src/index');

describe('Route: /path', () => {
  // Happy path
  it('should ...', async () => { });
  // Validation
  it('should reject invalid input', async () => { });
  // Auth
  it('should require authentication', async () => { });
  // Edge cases
  it('should handle empty results', async () => { });
});
```

**Flutter test template:**
```dart
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ClassName', () => {
    test('should ...', () { });
    test('handles null values', () { });
    test('edge case: empty list', () { });
  });
}
```

### 5. Run & Report

Run all tests after writing:
```bash
cd appredueri_backend && npm test
cd ofai_flutter && "C:/dev/flutter/bin/flutter.bat" test
```

Report:
```
📊 Test Coverage Report
━━━━━━━━━━━━━━━━━━━━━
✅ New tests: X
📁 Files tested: Y
🎯 Coverage: before → after
⚠️  Still uncovered: [list]
```
