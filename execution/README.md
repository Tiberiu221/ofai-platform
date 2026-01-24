# Execution

**Layer 3: Doing the work**

This directory contains deterministic Python scripts that handle:
- API calls
- Data processing
- File operations
- Database interactions
- Web scraping
- Data transformations

## Principles

- **Deterministic**: Same input = same output
- **Reliable**: Well-tested and error-handled
- **Fast**: Optimized for performance
- **Well-commented**: Clear documentation for maintenance

## Environment

- Environment variables and API tokens are stored in `.env`
- Use `python-dotenv` to load environment variables
- Never hardcode credentials

## Script Structure

Each script should:
1. Import required dependencies
2. Load environment variables
3. Define clear input/output interfaces
4. Include error handling
5. Provide useful logging
6. Return structured results

## Why Deterministic Scripts?

LLMs are probabilistic (90% accuracy per step = 59% success over 5 steps).
By pushing complexity into deterministic code, the AI agent only focuses on decision-making and orchestration.
