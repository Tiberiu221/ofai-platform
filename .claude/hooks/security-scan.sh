#!/bin/bash
# Security scan on file write — OFAI adapted
# Hook: PostToolUse (Edit|Write)
# Reads JSON from stdin, extracts file_path, scans for security issues

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

# Only scan relevant files
case "$FILE" in
  *.js|*.ejs|*.ts|*.dart|*.json) ;;
  *) exit 0 ;;
esac

# Skip node_modules and build dirs
echo "$FILE" | grep -qE "(node_modules|build|\.dart_tool)" && exit 0

ISSUES=0

# Hardcoded passwords
if grep -qE "(password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{8,}" "$FILE" 2>/dev/null; then
  echo "⚠️  SECURITY: Potential hardcoded password in $(basename "$FILE")"
  ISSUES=1
fi

# Hardcoded API keys / secrets
if grep -qE "(api[_-]?key|apikey|secret[_-]?key|access[_-]?token)\s*[:=]\s*['\"][^'\"]{10,}" "$FILE" 2>/dev/null; then
  echo "⚠️  SECURITY: Potential hardcoded API key/secret in $(basename "$FILE")"
  ISSUES=1
fi

# Private keys
if grep -q "BEGIN.*PRIVATE KEY" "$FILE" 2>/dev/null; then
  echo "🚨 SECURITY: Private key detected in $(basename "$FILE")"
  ISSUES=1
fi

# AWS keys
if grep -qE "AKIA[0-9A-Z]{16}" "$FILE" 2>/dev/null; then
  echo "🚨 SECURITY: AWS access key in $(basename "$FILE")"
  ISSUES=1
fi

# OFAI: SQL injection (string concat in queries)
if echo "$FILE" | grep -q "\.js$"; then
  if grep -qE "query\(.*\+\s*(req\.|params|body)" "$FILE" 2>/dev/null; then
    echo "⚠️  SECURITY: Potential SQL injection (string concat) in $(basename "$FILE")"
    ISSUES=1
  fi
fi

# OFAI: Missing USER_INPUT fencing in LLM services
if echo "$FILE" | grep -q "services/llm"; then
  if grep -qE "\\\$\{" "$FILE" 2>/dev/null; then
    if ! grep -q "USER_INPUT" "$FILE" 2>/dev/null; then
      echo "⚠️  SECURITY: LLM prompt missing [USER_INPUT] fencing in $(basename "$FILE")"
      ISSUES=1
    fi
  fi
fi

# OFAI: Missing CSP nonce on inline scripts in EJS
if echo "$FILE" | grep -q "\.ejs$"; then
  if grep -q "<script" "$FILE" 2>/dev/null; then
    if ! grep -q "nonce=" "$FILE" 2>/dev/null; then
      echo "⚠️  SECURITY: Inline <script> without CSP nonce in $(basename "$FILE")"
      ISSUES=1
    fi
  fi
fi

if [ $ISSUES -eq 0 ]; then
  echo "✅ Security scan clean"
fi

exit 0
