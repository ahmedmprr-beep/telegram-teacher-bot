"""
PDF Homework Solver
===================
Reads a PDF, extracts questions from each page, uses AI to solve them,
and creates a new PDF with the answers written after each page.
"""

import os
import sys
import fitz  # PyMuPDF
from openai import OpenAI
from dotenv import load_dotenv
import base64
import io
import textwrap

# ─── Load config ───────────────────────────────────────────────
load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = os.getenv("AI_MODEL", "google/gemini-2.5-flash")

if not API_KEY:
    print("❌ Error: OPENROUTER_API_KEY not found in .env file!")
    sys.exit(1)

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY,
)

# ─── Styling constants ────────────────────────────────────────
ANSWER_FONT = "helv"           # Helvetica
ANSWER_FONT_SIZE = 11
TITLE_FONT_SIZE = 14
LINE_HEIGHT = 16
MARGIN_X = 50
MARGIN_TOP = 60
MARGIN_BOTTOM = 50
PAGE_WIDTH = 595    # A4
PAGE_HEIGHT = 842   # A4
TEXT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X
CHARS_PER_LINE = 85  # approximate chars that fit per line


def extract_page_as_image(page: fitz.Page) -> str:
    """Render a PDF page to a base64-encoded PNG image."""
    pix = page.get_pixmap(dpi=200)
    img_bytes = pix.tobytes("png")
    return base64.b64encode(img_bytes).decode("utf-8")


def extract_page_text(page: fitz.Page) -> str:
    """Extract text from a PDF page."""
    return page.get_text("text").strip()


def solve_with_ai(page_text: str, page_image_b64: str, page_num: int) -> str:
    """
    Send page content to AI and get solved answers.
    Uses both text and image for maximum accuracy.
    """
    print(f"  🤖 Sending page {page_num} to AI for solving...")

    system_prompt = """You are an expert homework solver. You will receive a page from a homework/exam PDF.

Your job:
1. Identify ALL questions/problems on the page.
2. Solve each one completely with clear, step-by-step work.
3. Format your answers clearly.

Rules:
- Number your answers to match the question numbers on the page.
- Show your work/reasoning for each answer.
- Be thorough but concise.
- If the page has no questions (e.g., it's a title page or instructions only), respond with: "NO QUESTIONS ON THIS PAGE"
- For math problems, show all steps.
- For multiple choice, state the answer and explain why.
- For essay/short answer, provide a complete answer.
- Write in the same language as the questions."""

    messages = [
        {"role": "system", "content": system_prompt},
    ]

    # Build user message with both text and image
    user_content = []

    if page_image_b64:
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{page_image_b64}"
            }
        })

    user_content.append({
        "type": "text",
        "text": f"Here is page {page_num} of the homework. "
                f"Please solve all questions on this page.\n\n"
                f"Extracted text from this page:\n{page_text}" if page_text else
                f"Here is page {page_num} of the homework (image-based, no extractable text). "
                f"Please read the image and solve all questions."
    })

    messages.append({"role": "user", "content": user_content})

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=messages,
            max_tokens=4000,
            temperature=0.3,
        )
        answer = response.choices[0].message.content.strip()
        return answer
    except Exception as e:
        return f"⚠️ Error solving this page: {str(e)}"


def wrap_text(text: str, chars_per_line: int = CHARS_PER_LINE) -> list[str]:
    """Word-wrap text into lines that fit the page width."""
    lines = []
    for paragraph in text.split("\n"):
        if not paragraph.strip():
            lines.append("")
            continue
        wrapped = textwrap.wrap(paragraph, width=chars_per_line)
        if not wrapped:
            lines.append("")
        else:
            lines.extend(wrapped)
    return lines


def create_answer_pages(doc: fitz.Document, answer_text: str, page_num: int):
    """
    Insert answer page(s) into the document after the given page number.
    Returns the number of pages inserted.
    """
    if "NO QUESTIONS ON THIS PAGE" in answer_text:
        return 0

    lines = wrap_text(answer_text)

    # Calculate how many lines fit on one page
    usable_height = PAGE_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM
    lines_per_page = int(usable_height / LINE_HEIGHT) - 2  # reserve space for header

    # Split lines into page-sized chunks
    chunks = []
    for i in range(0, len(lines), lines_per_page):
        chunks.append(lines[i:i + lines_per_page])

    pages_inserted = 0
    for chunk_idx, chunk in enumerate(chunks):
        # Insert a new blank page after the original page
        insert_pos = page_num + pages_inserted + 1
        new_page = doc.new_page(pno=insert_pos, width=PAGE_WIDTH, height=PAGE_HEIGHT)

        # ── Draw header bar ──
        header_rect = fitz.Rect(0, 0, PAGE_WIDTH, 40)
        new_page.draw_rect(header_rect, color=None, fill=(0.15, 0.45, 0.85))

        # Header text
        header_text = f"✎ Answers for Page {page_num + 1}"
        if len(chunks) > 1:
            header_text += f" (part {chunk_idx + 1}/{len(chunks)})"

        new_page.insert_text(
            fitz.Point(MARGIN_X, 28),
            header_text,
            fontsize=TITLE_FONT_SIZE,
            fontname=ANSWER_FONT,
            color=(1, 1, 1),
        )

        # ── Draw separator line ──
        new_page.draw_line(
            fitz.Point(MARGIN_X, 48),
            fitz.Point(PAGE_WIDTH - MARGIN_X, 48),
            color=(0.15, 0.45, 0.85),
            width=1.5,
        )

        # ── Write answer text ──
        y = MARGIN_TOP + 10
        for line in chunk:
            if y > PAGE_HEIGHT - MARGIN_BOTTOM:
                break
            new_page.insert_text(
                fitz.Point(MARGIN_X, y),
                line,
                fontsize=ANSWER_FONT_SIZE,
                fontname=ANSWER_FONT,
                color=(0.1, 0.1, 0.1),
            )
            y += LINE_HEIGHT

        # ── Footer ──
        footer_text = "Generated by PDF Homework Solver"
        new_page.insert_text(
            fitz.Point(MARGIN_X, PAGE_HEIGHT - 25),
            footer_text,
            fontsize=8,
            fontname=ANSWER_FONT,
            color=(0.5, 0.5, 0.5),
        )

        pages_inserted += 1

    return pages_inserted


def solve_pdf(input_path: str, output_path: str = None) -> str:
    """
    Main function: reads a PDF, solves all questions, writes answers back.

    Args:
        input_path: Path to the input PDF file.
        output_path: Path for the solved PDF (default: adds '_solved' suffix).

    Returns:
        Path to the solved PDF file.
    """
    if not os.path.exists(input_path):
        print(f"❌ File not found: {input_path}")
        sys.exit(1)

    if not input_path.lower().endswith(".pdf"):
        print("❌ File must be a PDF!")
        sys.exit(1)

    # Default output path
    if not output_path:
        base, ext = os.path.splitext(input_path)
        output_path = f"{base}_solved{ext}"

    print(f"\n{'='*60}")
    print(f"  📄 PDF Homework Solver")
    print(f"{'='*60}")
    print(f"  Input:  {input_path}")
    print(f"  Output: {output_path}")
    print(f"  Model:  {MODEL}")
    print(f"{'='*60}\n")

    # Open the PDF
    doc = fitz.open(input_path)
    total_pages = len(doc)
    print(f"  📖 PDF has {total_pages} page(s)\n")

    # Process each page
    offset = 0  # tracks inserted answer pages to adjust indices
    for i in range(total_pages):
        actual_index = i + offset
        page = doc[actual_index]
        print(f"  📄 Processing page {i + 1}/{total_pages}...")

        # Extract text and image from the page
        page_text = extract_page_text(page)
        page_image_b64 = extract_page_as_image(page)

        # Solve with AI
        answer = solve_with_ai(page_text, page_image_b64, i + 1)

        if "NO QUESTIONS ON THIS PAGE" in answer:
            print(f"  ⏭️  Page {i + 1}: No questions found, skipping.\n")
            continue

        print(f"  ✅ Page {i + 1}: Got answers! Writing to PDF...\n")

        # Insert answer pages after the current page
        pages_added = create_answer_pages(doc, answer, actual_index)
        offset += pages_added

    # Save the solved PDF
    doc.save(output_path)
    doc.close()

    print(f"\n{'='*60}")
    print(f"  ✅ DONE! Solved PDF saved to:")
    print(f"  📁 {output_path}")
    print(f"{'='*60}\n")

    return output_path
