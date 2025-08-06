#!/bin/bash

# Docker build script for UI Analyzer Agent
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Default values
IMAGE_NAME="ui-analyzer-agent"
TAG="latest"
TARGET="production"
BUILD_ARGS=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        --target)
            TARGET="$2"
            shift 2
            ;;
        --dev)
            TARGET="development"
            shift
            ;;
        --build-arg)
            BUILD_ARGS="$BUILD_ARGS --build-arg $2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -t, --tag TAG       Docker image tag (default: latest)"
            echo "  --target TARGET     Docker build target (default: production)"
            echo "  --dev               Build development image"
            echo "  --build-arg KEY=VAL Add build argument"
            echo "  -h, --help          Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

print_status "Building UI Analyzer Agent Docker image..."
print_status "Target: $TARGET"
print_status "Tag: $TAG"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker and try again."
    exit 1
fi

# Create screenshots directory if it doesn't exist
if [ ! -d "screenshots" ]; then
    print_status "Creating screenshots directory..."
    mkdir -p screenshots
fi

# Build the Docker image
print_status "Building image: $IMAGE_NAME:$TAG"
docker build \
    --target $TARGET \
    --tag $IMAGE_NAME:$TAG \
    $BUILD_ARGS \
    .

if [ $? -eq 0 ]; then
    print_success "Docker image built successfully!"
    print_status "Image: $IMAGE_NAME:$TAG"
    
    # Show image info
    print_status "Image details:"
    docker images $IMAGE_NAME:$TAG
    
    print_status ""
    print_status "To run the container:"
    print_status "  docker run -p 8000:8000 $IMAGE_NAME:$TAG"
    print_status ""
    print_status "Or use docker-compose:"
    print_status "  docker-compose up -d"
    
else
    print_error "Failed to build Docker image"
    exit 1
fi 