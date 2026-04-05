---
description: Stage all changes, create a descriptive commit, and push to remote in one step. Safety checks included.
---

# Push All — Quick Commit & Push

Follow these steps exactly:

1. **Check status:**
   - Run `git status -s` to see all changes
   - Run `git diff --stat HEAD` to see what changed
   - If no changes, tell the user "No changes to commit" and stop

2. **Safety checks:**
   - WARN if any `.env` file is in the changes — do NOT commit it
   - WARN if `settings.local.json` is in changes — exclude it
   - WARN if any file > 5MB is being added
   - Check for merge conflicts (`<<<<<<<` markers)

3. **Create commit:**
   - Read `git log --oneline -5` to match commit message style
   - Stage all relevant files (exclude .env, settings.local.json, node_modules)
   - Write a concise commit message based on actual changes
   - Include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

4. **Push:**
   - Run `git push`
   - If rejected (remote ahead), run `git pull --rebase && git push`
   - Report success with commit hash

5. **Report:**
   ```
   ✅ Pushed [hash] to [branch]
   📝 [commit message]
   📊 [X files changed, Y insertions, Z deletions]
   ```
