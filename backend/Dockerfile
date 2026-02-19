FROM python:3.11-slim

# Install system dependencies (qpdf and ghostscript)
RUN apt-get update && apt-get install -y \
    qpdf \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create tmp directory for file processing
RUN mkdir -p tmp

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
