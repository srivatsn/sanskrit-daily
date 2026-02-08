#!/bin/bash

# Azure deployment script for Node.js app

# Exit on error
set -e

echo "Deployment started..."

# Install dependencies
echo "Installing dependencies..."
npm install --production=false

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Clean up dev dependencies (optional - keep them if needed for some reason)
# npm prune --production

echo "Deployment completed successfully!"
