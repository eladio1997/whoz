from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from deepface import DeepFace
import os
import shutil
import cv2
from datetime import datetime
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

app = FastAPI()
templates = Jinja2Templates(directory="templates")
PHOTOS_DIR = "photos"
UPLOADS_DIR = "saved_uploads"
CROPPED_DIR = "saved_cropped"
STATIC_DIR = "static"

# Create directories if they don't exist
os.makedirs(PHOTOS_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(CROPPED_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

def crop_face(image_path, save_path):
    try:
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Could not read image file")

        # Use DeepFace's enhanced face detection
        detected_faces = DeepFace.extract_faces(
            img_path=image_path,
            detector_backend="retinaface",
            enforce_detection=True,  # Enforce face detection
            align=False
        )

        if detected_faces and len(detected_faces) > 0:
            # Get the face with highest confidence
            best_face = max(detected_faces, key=lambda x: x['confidence'])
            facial_area = best_face['facial_area']
            
            # Extract coordinates with padding
            x, y, w, h = facial_area['x'], facial_area['y'], facial_area['w'], facial_area['h']
            padding = int(max(w, h) * 0.25)  # 25% padding
            
            # Adjust coordinates with boundary checks
            x1 = max(0, x - padding)
            y1 = max(0, y - padding)
            x2 = min(img.shape[1], x + w + padding)
            y2 = min(img.shape[0], y + h + padding)
            
            # Crop and save
            cropped_face = img[y1:y2, x1:x2]
            cv2.imwrite(save_path, cropped_face)
            return save_path

    except Exception as e:
        print(f"Face detection error: {e}")
        return None

    return None

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

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

    if not cropped_uploaded_path:
        return JSONResponse(
            content={"error": "Unable to detect face on this image. Please upload a proper photo with a clear face."},
            status_code=400
        )

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
                    # Copy matched image to static directory for serving
                    matched_image_path = os.path.join(STATIC_DIR, f"matched_{photo}")
                    shutil.copy2(db_path, matched_image_path)
                    
                    return {
                        "matched": True,
                        "matched_file": photo,
                        "similarity_score": result.get("distance", None),
                        "matched_image_url": f"/static/matched_{photo}"
                    }
            except Exception as e:
                print(f"Error comparing with {photo}: {e}")
                continue
    finally:
        pass

    return JSONResponse(content={"message": "No match found."}, status_code=404)

@app.get("/matched_image/{filename}")
async def get_matched_image(filename: str):
    image_path = os.path.join(STATIC_DIR, filename)
    if os.path.exists(image_path):
        return FileResponse(image_path)
    return JSONResponse(content={"error": "Image not found"}, status_code=404)