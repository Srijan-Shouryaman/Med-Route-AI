from app.services.report.ocr_service import extract_text_from_pdf


PDF_PATH = r"storage\reports\6b8e91d485b147a4b0a837fa1a6e37d6.pdf"


text = extract_text_from_pdf(PDF_PATH)

print("\n========== OCR RESULT ==========\n")
print(text)
print("\n========== END OCR RESULT ==========\n")

print(f"Extracted characters: {len(text)}")