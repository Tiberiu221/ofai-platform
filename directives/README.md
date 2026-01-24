# Directives

**Layer 1: What to do**

This directory contains Standard Operating Procedures (SOPs) written in Markdown that define:
- Goals and objectives
- Required inputs
- Tools/scripts to use from `execution/`
- Expected outputs
- Edge cases and error handling

These are natural language instructions, written like you'd give a mid-level employee.

## Structure

Each directive should include:

1. **Purpose**: What this directive accomplishes
2. **Inputs**: What data/parameters are needed
3. **Tools**: Which scripts from `execution/` to use
4. **Process**: Step-by-step workflow
5. **Outputs**: What gets generated
6. **Edge Cases**: Common errors and how to handle them

## Living Documents

Directives are continuously updated as we learn:
- API constraints and rate limits
- Better approaches
- Common errors
- Timing expectations

When the AI agent discovers improvements during execution, it updates the relevant directive.
