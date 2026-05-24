const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'dev.log');
const PID_FILE = path.join(__dirname, '.dev-server.pid');
const MAX_RESTARTS = 50;
let restartCount = 0;

function log(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [Manager] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function startServer() {
  if (restartCount >= MAX_RESTARTS) {
    log('Max restarts reached, giving up');
    process.exit(1);
  }

  restartCount++;
  log(`Starting server (attempt ${restartCount}/${MAX_RESTARTS})...`);

  // Kill any existing process on port 3000
  try {
    const { execSync } = require('child_process');
    execSync('fuser -k 3000/tcp 2>/dev/null || true', { timeout: 5000 });
  } catch (e) {}

  const child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env }
  });

  fs.writeFileSync(PID_FILE, String(child.pid));
  log(`Server PID: ${child.pid}`);

  child.stdout.on('data', (data) => {
    fs.appendFileSync(LOG_FILE, data);
  });

  child.stderr.on('data', (data) => {
    fs.appendFileSync(LOG_FILE, data);
  });

  child.on('exit', (code, signal) => {
    log(`Server exited with code=${code} signal=${signal}`);
    // Wait a bit then restart
    setTimeout(() => {
      startServer();
    }, 3000);
  });

  child.on('error', (err) => {
    log(`Server error: ${err.message}`);
    setTimeout(() => {
      startServer();
    }, 3000);
  });
}

// Handle manager shutdown
process.on('SIGTERM', () => { log('Manager received SIGTERM'); process.exit(0); });
process.on('SIGINT', () => { log('Manager received SIGINT'); process.exit(0); });

log('Server manager starting...');
startServer();
