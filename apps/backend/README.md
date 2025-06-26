# Website Analyzer

A simple Python tool that analyzes websites using Playwright and OpenAI's GPT-4o to identify UX/UI issues based on a predefined checklist.

## Quick Start

```bash
# 1. Install dependencies  
pip install -r requirements.txt
playwright install chromium

# 2. Add your OpenAI API key to .env
echo "OPENAI_API_KEY=your_key_here" > .env

# 3. Analyze any website
./run.sh https://example.com

# 4. Optionally save screenshots
./run.sh https://example.com --save-screenshots
```

## What It Checks

Evaluates websites against 13 UX/UI criteria:
1. Clear website goal understanding
2. Page load time (< 3 seconds)  
3. Call-to-action presence
4. Mobile responsiveness
5. Human images/emotional connection
6. Design consistency
7. Navigation clarity
8. Interactive element visibility
9. Search functionality
10. Text organization
11. Text contrast
12. Text alignment
13. Element spacing

## Output

- Load time measurement
- List of failed criteria with specific issues  
- **Automatic cleanup** - screenshots deleted after analysis (no storage bloat!)
- Optional screenshot saving with `--save-screenshots` flag

## Key Features

- 🗑️ **Zero storage footprint** - screenshots auto-deleted after analysis
- 🎯 **Consistent results** - same website always gives same analysis
- ⚡ **Fast analysis** - no cleanup needed
- 📸 **Optional screenshot saving** for debugging/review

## Files

- `analyzer.py` - Main analysis script
- `checklist.txt` - Criteria and responses
- `run.sh` - Execution script
- `requirements.txt` - Dependencies
