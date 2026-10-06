from pathlib import Path

import easyocr
import pymupdf


_reader = None


def get_ocr_reader():
    """
    Load the EasyOCR reader once and reuse it.
    """
    global _reader

    if _reader is None:
        _reader = easyocr.Reader(["en"], gpu=False)

    return _reader


def extract_text_from_pdf(file_path: str) -> str:
    """
    Render every PDF page as an image and extract text using EasyOCR.
    """

    pdf_path = Path(file_path)

    if not pdf_path.exists():
        raise FileNotFoundError(
            f"Report file not found: {pdf_path}"
        )

    reader = get_ocr_reader()
    document = pymupdf.open(pdf_path)

    extracted_pages = []

    try:
        total_pages = len(document)

        for page_number, page in enumerate(document, start=1):

            print(
                f"OCR processing page "
                f"{page_number}/{total_pages}..."
            )

            # Render PDF page as an image.
            pixmap = page.get_pixmap(
                matrix=pymupdf.Matrix(2, 2)
            )

            image_bytes = pixmap.tobytes("png")

            # OCR the rendered image.
            results = reader.readtext(
                image_bytes,
                detail=0,
                paragraph=True
            )

            page_text = "\n".join(results).strip()

            if page_text:
                extracted_pages.append(
                    f"--- Page {page_number} ---\n"
                    f"{page_text}"
                )

    finally:
        document.close()

    return "\n\n".join(extracted_pages).strip()