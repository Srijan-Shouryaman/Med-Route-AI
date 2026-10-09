from pathlib import Path
import re

import easyocr
import pymupdf


_reader = None


def get_ocr_reader():
    global _reader

    if _reader is None:
        _reader = easyocr.Reader(["en"], gpu=False)

    return _reader


def extract_text_from_pdf(file_path: str) -> str:
    pdf_path = Path(file_path)

    if not pdf_path.exists():
        raise FileNotFoundError(
            f"Report file not found: {pdf_path}"
        )

    document = pymupdf.open(pdf_path)

    try:
        pages = list(document)
        embedded_pages = []

        for page_number, page in enumerate(pages, start=1):
            page_text = page.get_text("text").strip()
            if page_text:
                embedded_pages.append(
                    f"--- Page {page_number} ---\n"
                    f"{page_text}"
                )

        embedded_text = "\n\n".join(embedded_pages).strip()
        if embedded_text and prepare_ml_text(embedded_text):
            return embedded_text

        reader = get_ocr_reader()
        extracted_pages = []
        total_pages = len(pages)

        for page_number, page in enumerate(pages, start=1):
            print(
                f"OCR processing page "
                f"{page_number}/{total_pages}..."
            )

            pixmap = page.get_pixmap(
                matrix=pymupdf.Matrix(3, 3)
            )

            image_bytes = pixmap.tobytes("png")

            results = reader.readtext(
                image_bytes,
                detail=1,
                paragraph=False
            )

            text_regions = []

            for result in results:
                if len(result) < 2:
                    continue

                coordinates = result[0]
                detected_text = result[1]

                if not detected_text or not detected_text.strip():
                    continue

                top = min(
                    point[1]
                    for point in coordinates
                )

                left = min(
                    point[0]
                    for point in coordinates
                )

                bottom = max(
                    point[1]
                    for point in coordinates
                )

                height = bottom - top

                text_regions.append(
                    {
                        "text": detected_text.strip(),
                        "top": top,
                        "left": left,
                        "height": height
                    }
                )

            text_regions.sort(
                key=lambda item: (
                    item["top"],
                    item["left"]
                )
            )

            lines = []

            for region in text_regions:
                if not lines:
                    lines.append(
                        {
                            "top": region["top"],
                            "height": region["height"],
                            "text": region["text"]
                        }
                    )
                    continue

                current_line = lines[-1]

                tolerance = max(
                    current_line["height"],
                    region["height"]
                ) * 0.5

                if abs(
                    region["top"] - current_line["top"]
                ) <= tolerance:
                    current_line["text"] += " "
                    current_line["text"] += region["text"]

                    current_line["height"] = max(
                        current_line["height"],
                        region["height"]
                    )
                else:
                    lines.append(
                        {
                            "top": region["top"],
                            "height": region["height"],
                            "text": region["text"]
                        }
                    )

            page_text = "\n".join(
                line["text"]
                for line in lines
                if line["text"].strip()
            ).strip()

            if page_text:
                extracted_pages.append(
                    f"--- Page {page_number} ---\n"
                    f"{page_text}"
                )

    finally:
        document.close()

    return "\n\n".join(extracted_pages).strip()


def prepare_ml_text(raw_text: str) -> str:
    if not raw_text:
        return ""

    text = raw_text

    text = re.sub(
        r"---\s*Page\s+\d+\s*---",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\bPage\s+\d+\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\bPatient\s+(?:ID|No|Number)\s*[:\-]?\s*[A-Za-z0-9\-]+",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\b(?:Patient\s+)?ID\s*[:\-]?\s*[A-Za-z0-9\-]{2,}",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\bPatient\s+Name\s*[:\-]?\s*[A-Za-z][A-Za-z0-9 .'-]{0,60}",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\bDate\s+of\s+Birth\s*[:\-]?\s*[A-Za-z0-9,\-/]+",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\b(?:DOB|Birth\s+Date)\s*[:\-]?\s*[A-Za-z0-9,\-/]+",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\bGender\s*[:\-]?\s*(?:Male|Female|Other|M|F)\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\b(?:Age)\s*[:\-]?\s*\d{1,3}\s*(?:years?|yrs?)?\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\b(?:Medical\s+Record|Record\s+No|MRN)\s*[:\-]?\s*[A-Za-z0-9\-]+",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\b(?:Hospital|Clinic|Department)\s+(?:ID|Code)\s*[:\-]?\s*[A-Za-z0-9\-]+",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"\bPAT[A-Z0-9]{2,}\b",
        " ",
        text,
        flags=re.IGNORECASE
    )

    text = re.sub(
        r"[_]+",
        " ",
        text
    )

    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )

    text = re.sub(
        r"\s*\n\s*",
        " ",
        text
    )

    text = re.sub(
        r"\s+([,.;:])",
        r"\1",
        text
    )

    text = re.sub(
        r"([,.;:]){2,}",
        r"\1",
        text
    )

    text = re.sub(
        r"\.{2,}",
        ".",
        text
    )

    text = re.sub(
        r"\s{2,}",
        " ",
        text
    )

    return text.strip(" \t\n.,:;-")
