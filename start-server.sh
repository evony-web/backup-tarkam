#!/bin/bash
# Double-fork technique to keep Next.js dev server running
cd /home/z/my-project

# Kill any existing process on port 3000
lsof -ti :3000 2>/dev/null | xargs kill -9 2>/dev/null
sleep 1

# Start the server in a detached process (double fork)
(
  npx next dev -p 3000 > /home/z/my-project/dev.log 2>&1
) &

# Disown the background process so it survives shell exit
disown

echo "Server started with double-fork technique, PID: $!"
