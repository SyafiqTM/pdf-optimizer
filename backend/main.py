from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import uuid
import subprocess
import shutil
import asyncio
from datetime import datetime, timedelta
from pathlib import Path

app = FastAPI()

# Allow React dev server and production frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://pdf-optimizer-nand.vercel.app",
        "https://*.vercel.app"  # Allow all Vercel preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TMP_DIR = os.environ.get("TMP_DIR", "/tmp" if os.name != 'nt' else "tmp")
os.makedirs(TMP_DIR, exist_ok=True)

# Cleanup configuration
CLEANUP_INTERVAL = 300  # Check every 5 minutes
FILE_MAX_AGE = 300  # 5 minutes in seconds


async def cleanup_old_files():
    """Background task to remove files older than 5 minutes"""
    while True:
        try:
            now = datetime.now()
            cutoff_time = now - timedelta(seconds=FILE_MAX_AGE)
            
            for file_path in Path(TMP_DIR).glob("*"):
                if file_path.is_file():
                    file_mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
                    if file_mtime < cutoff_time:
                        try:
                            file_path.unlink()
                            print(f"Cleaned up old file: {file_path.name}")
                        except Exception as e:
                            print(f"Failed to delete {file_path.name}: {e}")
        except Exception as e:
            print(f"Cleanup task error: {e}")
        
        await asyncio.sleep(CLEANUP_INTERVAL)


@app.on_event("startup")
async def startup_event():
    """Start background cleanup task"""
    asyncio.create_task(cleanup_old_files())
    print(f"✓ Background cleanup task started (files deleted after {FILE_MAX_AGE}s)")


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


def cleanup_job_files(job_id: str):
    """Remove all files associated with a job ID"""
    try:
        for file_path in Path(TMP_DIR).glob(f"{job_id}-*"):
            try:
                file_path.unlink()
                print(f"Cleaned up: {file_path.name}")
            except Exception as e:
                print(f"Failed to delete {file_path.name}: {e}")
    except Exception as e:
        print(f"Cleanup error for job {job_id}: {e}")



@app.post("/optimize")
async def optimize_pdf(file: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    # Check dependencies first
    missing = check_dependencies()
    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Missing required tools: {', '.join(missing)}. Please install them first."
        )
    
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )

    # Read file content
    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)
    
    # Vercel has a 4.5MB request body limit — only enforce when deployed there
    IS_VERCEL = os.environ.get("FILE_SIZE_LIMIT") or False
    MAX_SIZE_MB = 4.0  # Safe limit for Vercel's 4.5MB request body cap
    if IS_VERCEL and file_size_mb > MAX_SIZE_MB:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({file_size_mb:.2f}MB). Maximum allowed size is {MAX_SIZE_MB}MB due to serverless platform limits."
        )

    job_id = str(uuid.uuid4())

    input_path = os.path.join(TMP_DIR, f"{job_id}-input.pdf")
    qpdf_path = os.path.join(TMP_DIR, f"{job_id}-qpdf.pdf")
    output_path = os.path.join(TMP_DIR, f"{job_id}-optimized.pdf")

    # Save uploaded file (content already read for size check)
    with open(input_path, "wb") as f:
        f.write(content)

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

    # Schedule cleanup after response is sent
    if background_tasks:
        background_tasks.add_task(cleanup_job_files, job_id)

    return FileResponse(
        output_path,
        media_type="application/pdf",
        filename=f"optimized-{file.filename}"
    )
