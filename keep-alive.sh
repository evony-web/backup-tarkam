#!/bin/bash
# Kill any existing server first
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

# Start server in fully detached session
# Using setsid to create new session, disown, and nohup
setsid bash -c 'cd /home/z/my-project && exec node node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1' &
echo "Launcher PID: $!"
sleep 1
echo "Server should be running in detached session"
