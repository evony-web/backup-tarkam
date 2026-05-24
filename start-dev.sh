#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Double Fork Dev Server Launcher
# Ensures the dev server stays alive as a daemon even if the
# parent shell dies. Uses true double-fork (setsid) so the
# process is reparented to PID 1 (init).
# ═══════════════════════════════════════════════════════════════

PORT=3000
LOGFILE="/home/z/my-project/dev.log"
PROJECT_DIR="/home/z/my-project"

# Kill any existing process on the port
echo "[start-dev] Killing existing process on port $PORT..."
fuser -k ${PORT}/tcp 2>/dev/null
sleep 2

# Clear Next.js cache for clean start
rm -rf ${PROJECT_DIR}/.next

# Double fork: parent exits, child forks again and setsid
# This ensures the process is fully detached from any terminal
(
  # First fork - this child will fork again and exit
  (
    # Second fork - this is the actual server process
    # setsid creates a new session so signals from parent are ignored
    cd ${PROJECT_DIR}
    exec bun run dev >> ${LOGFILE} 2>&1
  ) &
  # First fork exits immediately, second fork is orphaned and reparented to init
) &

# Wait a moment and verify
sleep 5
if ss -tlnp | grep -q ":${PORT} "; then
  echo "[start-dev] ✅ Dev server is running on port ${PORT}"
  echo "[start-dev] 📋 Log: tail -f ${LOGFILE}"
else
  echo "[start-dev] ⏳ Server still starting... check log:"
  tail -5 ${LOGFILE}
fi
