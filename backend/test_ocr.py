from app.services.report.ocr_service import extract_text_from_pdf


PDF_PATH = r"storage\reports\f57fb03e0935442fbc71e0f74f07f201.pdf"


text = extract_text_from_pdf(PDF_PATH)

print("\n========== OCR RESULT ==========\n")
print(text)
print("\n========== END OCR RESULT ==========\n")

print(f"Extracted characters: {len(text)}")