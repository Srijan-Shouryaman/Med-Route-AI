from app.services.report.ocr_service import prepare_ml_text

text = """--- Page 1 ---
PAT1OO Medical Report
Patient Information Patient ID: PAT1OO
Patient Name: Test Patient 100
Date of Birth: 15-May-2002
Gender: Male
Clinical Presentation The patient presents with chest pain and shortness of breath.
Symptoms have prompted clinical evaluation for a possible cardiovascular cause_
Investigations ECG: Sinus rhythm_
Clinical findings require further cardiovascular assessment
Assessment The findings are suggestive of a possible cardiovascular condition.
Recommendation Cardiology consultation is recommended for further evaluation and management:"""

print(prepare_ml_text(text))