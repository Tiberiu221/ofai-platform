#!/bin/bash
# Format check after file write — OFAI adapted
# Hook: PostToolUse (Edit|Write)
# Reads JSON from stdin, extracts file_path, checks style issues

INPUT=$(cat)

# Extract file_path from stdin JSON
if command -v jq &>/dev/null; then
  FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4)
fi

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  exit 0
fi

# Skip non-code files and build dirs
echo "$FILE" | grep -qE "(node_modules|build|\.dart_tool|\.png|\.jpg|\.svg)" && exit 0

case "$FILE" in
  *.js|*.jsx)
    # Check for console.log in routes (not in services/helpers)
    if echo "$FILE" | grep -q "routes/"; then
      LOGS=$(grep -c "console\.log(" "$FILE" 2>/dev/null)
      if [ "$LOGS" -gt 3 ]; then
        echo "💅 Style: $(basename "$FILE") has $LOGS console.log() — consider removing debug logs"
      fi
    fi
    ;;
  *.dart)
    # Check for print() in production code (not tests)
    if echo "$FILE" | grep -qv "_test\.dart$"; then
      PRINTS=$(grep -c "print(" "$FILE" 2>/dev/null)
      if [ "$PRINTS" -gt 0 ]; then
        echo "💅 Style: $(basename "$FILE") has $PRINTS print() calls — use debugPrint() or remove"
      fi
    fi
    ;;
  *.ejs)
    # Check for unclosed EJS tags
    OPENS=$(grep -co "<%[-=]\?" "$FILE" 2>/dev/null || echo 0)
    CLOSES=$(grep -co "%>" "$FILE" 2>/dev/null || echo 0)
    if [ "$OPENS" != "$CLOSES" ] 2>/dev/null; then
      echo "⚠️  Template: $(basename "$FILE") may have unclosed EJS tags (opens=$OPENS, closes=$CLOSES)"
    fi
    ;;
esac

exit 0
