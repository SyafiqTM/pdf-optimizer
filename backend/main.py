from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import uuid
import subprocess
import shutil

app = FastAPI()

# Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TMP_DIR = "tmp"
os.makedirs(TMP_DIR, exist_ok=True)


def check_dependencies():
    """Check if required executables are available"""
    missing = []
    if not shutil.which("qpdf"):
        missing.append("qpdf")
    
    # Check for ghostscript (different names on different OS)
    gs_found = False
    if os.name == 'nt':
        # Windows: check for gswin64c or gswin32c
        if shutil.which("gswin64c") or shutil.which("gswin32c"):
            gs_found = True
    else:
        # Linux/Mac: check for gs
        if shutil.which("gs"):
            gs_found = True
    
    if not gs_found:
        missing.append("ghostscript (gs)")
    
    return missing


def run_cmd(cmd: list[str]):
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            raise Exception(result.stderr.decode("utf-8", errors="ignore"))
    except FileNotFoundError:
        raise Exception(f"Executable '{cmd[0]}' not found. Please install it first.")


@app.post("/optimize")
async def optimize_pdf(file: UploadFile = File(...)):
    # Check dependencies first
    missing = check_dependencies()
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required tools: {', '.join(missing)}. Please install them first."
        )
    
    if file.content_type != "application/pdf":
        return {"error": "Only PDF files allowed"}

    job_id = str(uuid.uuid4())

    input_path = os.path.join(TMP_DIR, f"{job_id}-input.pdf")
    qpdf_path = os.path.join(TMP_DIR, f"{job_id}-qpdf.pdf")
    output_path = os.path.join(TMP_DIR, f"{job_id}-optimized.pdf")

    # Save uploaded file
    with open(input_path, "wb") as f:
        f.write(await file.read())

    # Step 1: qpdf (linearize + cleanup)
    run_cmd([
        "qpdf",
        "--linearize",
        "--object-streams=generate",
        input_path,
        qpdf_path
    ])

    # Step 2: Ghostscript compression
    gs_cmd = "gs"
    # On Windows, try gswin64c or gswin32c
    if os.name == 'nt':
        if shutil.which("gswin64c"):
            gs_cmd = "gswin64c"
        elif shutil.which("gswin32c"):
            gs_cmd = "gswin32c"
    
    run_cmd([
        gs_cmd,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dPDFSETTINGS=/ebook",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        f"-sOutputFile={output_path}",
        qpdf_path
    ])

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=f"optimized-{file.filename}"
    )
