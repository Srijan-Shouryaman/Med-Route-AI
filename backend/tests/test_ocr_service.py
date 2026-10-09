import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from app.services.report import ocr_service


class FakeDocument(list):
    def __init__(self, pages):
        super().__init__(pages)
        self.closed = False

    def close(self):
        self.closed = True


class ExtractTextFromPdfTests(unittest.TestCase):
    def make_pdf_path(self, directory):
        path = Path(directory) / "report.pdf"
        path.write_bytes(b"test PDF placeholder")
        return path

    def test_usable_embedded_text_bypasses_ocr(self):
        page = Mock()
        page.get_text.return_value = "Clinical impression: stable cardiomegaly."
        document = FakeDocument([page])

        with tempfile.TemporaryDirectory() as directory:
            path = self.make_pdf_path(directory)
            with patch.object(ocr_service.pymupdf, "open", return_value=document), \
                    patch.object(ocr_service, "get_ocr_reader") as get_reader:
                result = ocr_service.extract_text_from_pdf(str(path))

        self.assertEqual(
            result,
            "--- Page 1 ---\nClinical impression: stable cardiomegaly.",
        )
        page.get_text.assert_called_once_with("text")
        page.get_pixmap.assert_not_called()
        get_reader.assert_not_called()
        self.assertTrue(document.closed)

    def test_scanned_pdf_falls_back_to_ocr(self):
        page = Mock()
        page.get_text.return_value = ""
        page.get_pixmap.return_value.tobytes.return_value = b"rendered image"
        document = FakeDocument([page])
        reader = Mock()
        reader.readtext.return_value = [
            ([(0, 0), (20, 0), (20, 8), (0, 8)], "Scanned clinical finding", 0.99),
        ]

        with tempfile.TemporaryDirectory() as directory:
            path = self.make_pdf_path(directory)
            with patch.object(ocr_service.pymupdf, "open", return_value=document), \
                    patch.object(ocr_service, "get_ocr_reader", return_value=reader), \
                    patch.object(ocr_service.pymupdf, "Matrix", return_value="3x matrix") as matrix:
                result = ocr_service.extract_text_from_pdf(str(path))

        self.assertEqual(result, "--- Page 1 ---\nScanned clinical finding")
        matrix.assert_called_once_with(3, 3)
        page.get_pixmap.assert_called_once_with(matrix="3x matrix")
        reader.readtext.assert_called_once_with(
            b"rendered image",
            detail=1,
            paragraph=False,
        )
        self.assertTrue(document.closed)

    def test_unusable_embedded_text_and_empty_ocr_return_empty_text(self):
        page = Mock()
        page.get_text.return_value = "Patient ID: PAT100"
        page.get_pixmap.return_value.tobytes.return_value = b"rendered image"
        document = FakeDocument([page])
        reader = Mock()
        reader.readtext.return_value = []

        with tempfile.TemporaryDirectory() as directory:
            path = self.make_pdf_path(directory)
            with patch.object(ocr_service.pymupdf, "open", return_value=document), \
                    patch.object(ocr_service, "get_ocr_reader", return_value=reader):
                result = ocr_service.extract_text_from_pdf(str(path))

        self.assertEqual(result, "")
        reader.readtext.assert_called_once()
        page.get_pixmap.assert_called_once()
        self.assertTrue(document.closed)


if __name__ == "__main__":
    unittest.main()
