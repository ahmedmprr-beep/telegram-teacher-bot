"""
PDF Homework Solver - CLI Entry Point
======================================
Usage:
    python solve.py <path_to_pdf>
    python solve.py <path_to_pdf> <output_path>

Examples:
    python solve.py math_homework.pdf
    python solve.py "C:\\Users\\me\\Documents\\exam.pdf"
    python solve.py homework.pdf homework_solved.pdf
"""

import sys
import os
import glob
import time

# Add current dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pdf_solver import solve_pdf


def print_banner():
    """Print a nice startup banner."""
    print()
    print("  ╔══════════════════════════════════════════════╗")
    print("  ║         📚 PDF HOMEWORK SOLVER 📚           ║")
    print("  ║                                              ║")
    print("  ║   Drop a PDF → Get it solved → That easy!   ║")
    print("  ╚══════════════════════════════════════════════╝")
    print()


def main():
    print_banner()

    if len(sys.argv) < 2:
        # No file provided - check if there are PDFs in the current folder
        pdf_files = glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "*.pdf"))

        if not pdf_files:
            print("  ❌ No PDF file provided and no PDFs found in the homework folder.")
            print()
            print("  Usage:")
            print("    python solve.py <path_to_pdf>")
            print("    python solve.py myfile.pdf")
            print()
            print("  Or just drop a PDF file into the homework folder and run:")
            print("    python solve.py")
            print()
            sys.exit(1)

        # Show available PDFs
        unsolved = [f for f in pdf_files if "_solved" not in f]
        if not unsolved:
            print("  ✅ All PDFs in this folder are already solved!")
            sys.exit(0)

        print(f"  📂 Found {len(unsolved)} unsolved PDF(s) in homework folder:\n")
        for idx, f in enumerate(unsolved, 1):
            name = os.path.basename(f)
            size_mb = os.path.getsize(f) / (1024 * 1024)
            print(f"    {idx}. {name} ({size_mb:.1f} MB)")

        print()

        if len(unsolved) == 1:
            choice = 1
            print(f"  → Auto-selecting the only PDF found.\n")
        else:
            try:
                choice = int(input("  Enter the number of the PDF to solve (or 0 for all): "))
            except (ValueError, KeyboardInterrupt):
                print("\n  ❌ Invalid choice. Exiting.")
                sys.exit(1)

        if choice == 0:
            # Solve all
            for f in unsolved:
                solve_pdf(f)
        elif 1 <= choice <= len(unsolved):
            solve_pdf(unsolved[choice - 1])
        else:
            print("  ❌ Invalid choice. Exiting.")
            sys.exit(1)
    else:
        # File path provided as argument
        input_path = sys.argv[1]

        # Handle relative paths
        if not os.path.isabs(input_path):
            input_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), input_path)

        output_path = sys.argv[2] if len(sys.argv) > 2 else None

        start_time = time.time()
        result = solve_pdf(input_path, output_path)
        elapsed = time.time() - start_time

        print(f"  ⏱️  Completed in {elapsed:.1f} seconds")
        print(f"  📄 Result: {result}")


if __name__ == "__main__":
    main()
