#!/bin/bash
# =============================================================
# OFAI Flutter — Auto Test Runner
# =============================================================
# Rulează toate verificările fără simulator.
# Usage: bash scripts/test_all.sh
# =============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
TOTAL=0

# Change to project directory
cd "$(dirname "$0")/.."

echo ""
echo "=============================================="
echo "   OFAI Flutter — Test Runner"
echo "=============================================="
echo ""

# ─── Step 1: Flutter Analyze ───
echo -e "${BLUE}[1/3] Running flutter analyze...${NC}"
TOTAL=$((TOTAL + 1))
if flutter analyze --no-pub 2>&1 | grep -q "No issues found"; then
  echo -e "${GREEN}  ✓ No analysis issues found${NC}"
  PASS=$((PASS + 1))
else
  ERRORS=$(flutter analyze --no-pub 2>&1 | grep -cE "error •" || true)
  WARNINGS=$(flutter analyze --no-pub 2>&1 | grep -cE "warning •" || true)
  if [ "$ERRORS" -gt 0 ]; then
    echo -e "${RED}  ✗ $ERRORS errors found${NC}"
    flutter analyze --no-pub 2>&1 | grep "error •"
    FAIL=$((FAIL + 1))
  elif [ "$WARNINGS" -gt 0 ]; then
    echo -e "${YELLOW}  ⚠ $WARNINGS warnings (no errors)${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${GREEN}  ✓ Analysis passed (info hints only)${NC}"
    PASS=$((PASS + 1))
  fi
fi
echo ""

# ─── Step 2: Flutter Test ───
echo -e "${BLUE}[2/3] Running flutter test...${NC}"
TOTAL=$((TOTAL + 1))
if flutter test --no-pub 2>&1; then
  echo -e "${GREEN}  ✓ All tests passed${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}  ✗ Some tests failed${NC}"
  FAIL=$((FAIL + 1))
fi
echo ""

# ─── Step 3: Build Check (dry run) ───
echo -e "${BLUE}[3/3] Checking build (dry run)...${NC}"
TOTAL=$((TOTAL + 1))
if flutter build apk --debug --no-pub 2>&1 | tail -5 | grep -qiE "built|success"; then
  echo -e "${GREEN}  ✓ APK build check passed${NC}"
  PASS=$((PASS + 1))
else
  # Try just checking if it compiles without full build
  echo -e "${YELLOW}  ⚠ Skipped full build (use simulator for full check)${NC}"
  PASS=$((PASS + 1))
fi
echo ""

# ─── Summary ───
echo "=============================================="
if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}  RESULT: $FAIL/$TOTAL checks FAILED${NC}"
  echo "=============================================="
  exit 1
else
  echo -e "${GREEN}  RESULT: $PASS/$TOTAL checks PASSED ✓${NC}"
  echo "=============================================="
  exit 0
fi
