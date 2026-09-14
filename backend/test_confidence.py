from app.ml.inference.confidence import calculate_confidence


scores = [
    -0.44523114,
     0.20023030,
    -1.46629162,
    -1.12970897,
    -0.35954665
]

result = calculate_confidence(scores)

print(result)