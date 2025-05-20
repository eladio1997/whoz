from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from deepface import DeepFace
import os
import shutil
from tempfile import NamedTemporaryFile

app = FastAPI()
PHOTOS_DIR = "photos"

@app.post("/verify/")
async def verify_image(file: UploadFile = File(...)):
    # Save the uploaded file temporarily
    with NamedTemporaryFile(delete=False, suffix=".jpg") as temp:
        shutil.copyfileobj(file.file, temp)
        uploaded_path = temp.name

    # Compare with each photo in the "photos" folder
    try:
        for photo in os.listdir(PHOTOS_DIR):
            db_path = os.path.join(PHOTOS_DIR, photo)
            try:
                result = DeepFace.verify(img1_path=uploaded_path, img2_path=db_path, model_name="Facenet", enforce_detection=False)
                if result["verified"]:
                    os.remove(uploaded_path)
                    print({
                        "matched_file": photo,
                        "similarity_score": result.get("distance", None)
                    })
                    return {
                        "matched_file": photo,
                        "similarity_score": result.get("distance", None)
                    }
            except Exception as e:
                continue
    finally:
        # Clean up temp file if not matched
        if os.path.exists(uploaded_path):
            os.remove(uploaded_path)
    print({"message": "No match found."})
    return JSONResponse(content={"message": "No match found."}, status_code=404)

# if __name__ == "__main__":
#     main()
