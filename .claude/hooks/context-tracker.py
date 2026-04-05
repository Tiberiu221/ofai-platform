#!/usr/bin/env python3
"""
Context Usage Tracker for OFAI project.
Estimates token usage per request and warns when approaching limits.

Hooks: UserPromptSubmit (pre) + Stop (post)
Uses character-based estimation (~4 chars/token, ~80-90% accuracy).
"""
import json
import os
import sys
import tempfile

# Claude model context limits
CONTEXT_LIMIT = 200000  # Claude Opus context window

def get_state_file(session_id: str) -> str:
    return os.path.join(tempfile.gettempdir(), f"ofai-context-{session_id}.json")

def count_tokens_estimate(text: str) -> int:
    """~4 chars per token, ~80-90% accuracy for English/code."""
    return len(text) // 4

def read_transcript(transcript_path: str) -> str:
    if not transcript_path or not os.path.exists(transcript_path):
        return ""
    content = []
    with open(transcript_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                entry = json.loads(line.strip())
                if "message" in entry:
                    msg = entry["message"]
                    if isinstance(msg.get("content"), str):
                        content.append(msg["content"])
                    elif isinstance(msg.get("content"), list):
                        for block in msg["content"]:
                            if isinstance(block, dict) and block.get("type") == "text":
                                content.append(block.get("text", ""))
            except (json.JSONDecodeError, KeyError):
                continue
    return "\n".join(content)

def handle_user_prompt_submit(data: dict) -> None:
    session_id = data.get("session_id", "unknown")
    transcript_path = data.get("transcript_path", "")
    transcript = read_transcript(transcript_path)
    tokens = count_tokens_estimate(transcript)

    state_file = get_state_file(session_id)
    with open(state_file, "w") as f:
        json.dump({"pre_tokens": tokens, "request_count": 0}, f)

def handle_stop(data: dict) -> None:
    session_id = data.get("session_id", "unknown")
    transcript_path = data.get("transcript_path", "")
    transcript = read_transcript(transcript_path)
    current_tokens = count_tokens_estimate(transcript)

    state_file = get_state_file(session_id)
    pre_tokens = 0
    request_count = 0
    if os.path.exists(state_file):
        try:
            with open(state_file, "r") as f:
                state = json.load(f)
                pre_tokens = state.get("pre_tokens", 0)
                request_count = state.get("request_count", 0) + 1
        except (json.JSONDecodeError, IOError):
            pass

    # Save updated count
    with open(state_file, "w") as f:
        json.dump({"pre_tokens": current_tokens, "request_count": request_count}, f)

    delta = current_tokens - pre_tokens
    remaining = CONTEXT_LIMIT - current_tokens
    pct = (current_tokens / CONTEXT_LIMIT) * 100

    # Color-coded output
    if pct >= 90:
        icon = "🔴"
        warn = " — CRITICAL: Consider starting a new session!"
    elif pct >= 75:
        icon = "🟡"
        warn = " — Getting full, plan wrap-up"
    elif pct >= 50:
        icon = "🟠"
        warn = ""
    else:
        icon = "🟢"
        warn = ""

    print(
        f"{icon} Context: ~{current_tokens:,}/{CONTEXT_LIMIT:,} tokens "
        f"({pct:.0f}%) | This request: ~{delta:,} | "
        f"Remaining: ~{remaining:,}{warn}",
        file=sys.stderr,
    )

def main():
    data = json.load(sys.stdin)
    event = data.get("hook_event_name", "")

    if event == "UserPromptSubmit":
        handle_user_prompt_submit(data)
    elif event == "Stop":
        handle_stop(data)

    sys.exit(0)

if __name__ == "__main__":
    main()
