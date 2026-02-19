# PDF Optimizer - Docker Setup

## Prerequisites

- Docker Desktop installed on your system
- Docker Compose (included with Docker Desktop)

## Quick Start

### 1. Build and Start the Containers

From the project root directory, run:

```bash
docker-compose up --build
```

This will:
- Build both frontend and backend Docker images
- Start both services
- Backend will be available at http://localhost:8000
- Frontend will be available at http://localhost:5173

### 2. Stop the Containers

Press `Ctrl+C` in the terminal, or run:

```bash
docker-compose down
```

### 3. Run in Detached Mode (Background)

To run the containers in the background:

```bash
docker-compose up -d
```

View logs:

```bash
docker-compose logs -f
```

Stop background containers:

```bash
docker-compose down
```

## Services

### Backend (FastAPI)
- **Port**: 8000
- **API Documentation**: http://localhost:8000/docs
- **Dependencies**: qpdf, ghostscript (pre-installed in container)

### Frontend (React + Vite)
- **Port**: 5173
- **Hot Reload**: Enabled

## Docker Commands Cheat Sheet

```bash
# Build images
docker-compose build

# Start services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart backend
docker-compose restart frontend

# Remove all containers and volumes
docker-compose down -v

# Rebuild without cache
docker-compose build --no-cache
```

## Troubleshooting

### Port Already in Use

If ports 8000 or 5173 are already in use, edit `docker-compose.yml` and change the port mappings:

```yaml
ports:
  - "8001:8000"  # Use port 8001 instead of 8000
```

### File Changes Not Reflecting

Restart the containers:

```bash
docker-compose restart
```

Or rebuild:

```bash
docker-compose up --build
```
