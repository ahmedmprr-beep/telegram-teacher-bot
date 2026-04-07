# 📚 PDF Homework Solver

A Python tool that automatically solves homework/exam PDFs using AI.

## How It Works

1. **Drop** a PDF file into this folder
2. **Run** the solver
3. **Get** a new PDF with all answers written in!

The solver reads each page (both text and images), sends it to an AI model, and creates a new PDF with answer pages inserted after each question page.

## Setup (One Time)

```bash
pip install -r requirements.txt
```

## Usage

### Option 1: Drop & Solve
1. Copy your PDF into this `homework` folder
2. Run:
```bash
python solve.py
```
3. It will auto-detect your PDF and solve it!

### Option 2: Specify a file
```bash
python solve.py math_homework.pdf
python solve.py "C:\path\to\any\file.pdf"
```

### Option 3: Custom output name
```bash
python solve.py homework.pdf my_answers.pdf
```

## Output

- The solved PDF will be saved as `<filename>_solved.pdf`
- Original pages are kept untouched
- Answer pages (with a blue header) are inserted after each question page

## Configuration

Edit the `.env` file to change:
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `AI_MODEL` - The AI model to use (default: `google/gemini-2.5-flash`)
