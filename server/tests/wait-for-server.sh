#!/bin/bash

# Wait for server to be healthy
# This script polls the health endpoint until it returns a successful response

MAX_ATTEMPTS=60  # Maximum number of attempts (60 * 2 seconds = 2 minutes)
ATTEMPT=0
SERVER_URL="http://localhost:8000"

echo "Waiting for server to be healthy at $SERVER_URL/health..."

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    
    # Try to curl the health endpoint
    if curl -f -s "$SERVER_URL/health" > /dev/null 2>&1; then
        echo "✅ Server is healthy! (attempt $ATTEMPT)"
        exit 0
    fi
    
    echo "⏳ Attempt $ATTEMPT/$MAX_ATTEMPTS - Server not ready yet, waiting 2 seconds..."
    sleep 2
done

echo "❌ Server failed to become healthy after $MAX_ATTEMPTS attempts"
echo "Last response:"
curl -v "$SERVER_URL/health" || echo "Connection failed"
exit 1 