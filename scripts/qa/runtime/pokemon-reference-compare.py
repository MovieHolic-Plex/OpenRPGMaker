"""Read-only image comparison diagnostic (requires numpy and OpenCV).

Usage: python scripts/qa/runtime/pokemon-reference-compare.py REFERENCE CAPTURE
SSIM is NOT a calibrated perceptual match percentage or an acceptance gate.
Korean/English text and the differing aspect ratios affect the full-frame score.
No source image is edited or saved by this script.
"""
import json
import sys

import cv2
import numpy as np


def ssim(first, second):
    first, second = first.astype(float), second.astype(float)
    blur = lambda image: cv2.GaussianBlur(image, (11, 11), 1.5)
    mu_first, mu_second = blur(first), blur(second)
    var_first = blur(first * first) - mu_first * mu_first
    var_second = blur(second * second) - mu_second * mu_second
    covariance = blur(first * second) - mu_first * mu_second
    numerator = (2 * mu_first * mu_second + 6.5025) * (2 * covariance + 58.5225)
    denominator = (mu_first**2 + mu_second**2 + 6.5025) * (var_first + var_second + 58.5225)
    return round(float(np.mean(numerator / denominator)), 5)


reference = cv2.imread(sys.argv[1])
capture = cv2.imread(sys.argv[2])
if reference is None or capture is None:
    raise SystemExit("Both arguments must be readable images")
if reference.shape[:2] != (567, 765):
    raise SystemExit("Region coordinates require the supplied 765×567 reference")
original_capture_size = list(capture.shape[:2][::-1])
capture = cv2.resize(capture, (765, 567), interpolation=cv2.INTER_AREA)
regions = {
    "full_frame_including_localized_text": (0, 0, 765, 567),
    "unobstructed_background": (365, 0, 145, 215),
    "enemy_sprite_and_surroundings": (515, 145, 120, 135),
    "rear_sprite_and_surroundings": (105, 330, 160, 100),
    "commands_including_localized_text": (370, 433, 395, 134),
}
scores = {}
for name, (x, y, width, height) in regions.items():
    scores[name] = ssim(capture[y:y+height, x:x+width], reference[y:y+height, x:x+width])
print(json.dumps({
    "method": "RGB SSIM, 11×11 Gaussian window, sigma 1.5, C1=6.5025, C2=58.5225",
    "reference_size": [765, 567],
    "capture_size_before_analysis_resize": original_capture_size,
    "acceptance_status": "unproven: these diagnostics do not establish 95% perceived similarity",
    "scores": scores,
}, indent=2))
