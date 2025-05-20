from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from deepface import DeepFace
import os
import shutil
from tempfile import NamedTemporaryFile
import cv2
from datetime import datetime

app = FastAPI()

PHOTOS_DIR = "photos"
UPLOADS_DIR = "saved_uploads"
CROPPED_DIR = "saved_cropped"

# Create directories if they don't exist
os.makedirs(PHOTOS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(CROPPED_DIR, exist_ok=True)

# Helper function to crop face
def crop_face(image_path, save_path):
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 4)

    if len(faces) == 0:
        shutil.copy(image_path, save_path)  # Save the original if no face found
        return save_path

    x, y, w, h = faces[0]
    cropped_face = img[y:y+h, x:x+w]
    cv2.imwrite(save_path, cropped_face)
    return save_path

@app.post("/verify/")
async def verify_image(file: UploadFile = File(...)):
    # Save uploaded file with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    upload_filename = f"{timestamp}_{file.filename}"
    uploaded_path = os.path.join(UPLOADS_DIR, upload_filename)

    with open(uploaded_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Crop the face and save to CROPPED_DIR
    cropped_path = os.path.join(CROPPED_DIR, f"cropped_{upload_filename}")
    cropped_uploaded_path = crop_face(uploaded_path, cropped_path)

    try:
        for photo in os.listdir(PHOTOS_DIR):
            db_path = os.path.join(PHOTOS_DIR, photo)
            try:
                result = DeepFace.verify(
                    img1_path=cropped_uploaded_path,
                    img2_path=db_path,
                    model_name="Facenet",
                    enforce_detection=False
                )
                if result["verified"]:
                    return {
                        "matched_file": photo,
                        "similarity_score": result.get("distance", None)
                    }
            except Exception:
                continue
    finally:
        # Do NOT delete uploaded/cropped files (you asked to save them)
        pass

    return JSONResponse(content={"message": "No match found."}, status_code=404)
