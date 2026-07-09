const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', 'Starting backend and frontend concurrently...');

function prefixStream(stream, prefix, colorCode) {
  const rl = readline.createInterface({
    input: stream,
    terminal: false
  });

  rl.on('line', (line) => {
    console.log(`${colorCode}${prefix}\x1b[0m ${line}`);
  });
}

// Spawn backend
const backend = spawn(npmCmd, ['start'], {
  cwd: path.join(__dirname, 'backend'),
  shell: true
});

prefixStream(backend.stdout, '[Backend]', '\x1b[32m'); // Green
prefixStream(backend.stderr, '[Backend ERROR]', '\x1b[31m'); // Red

// Spawn frontend
const frontend = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'frontend'),
  shell: true
});

prefixStream(frontend.stdout, '[Frontend]', '\x1b[34m'); // Blue
prefixStream(frontend.stderr, '[Frontend ERROR]', '\x1b[31m'); // Red

let isCleaningUp = false;
function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;
  console.log('\n\x1b[33mStopping all processes...\x1b[0m');

  try {
    if (isWindows) {
      if (backend.pid) spawn('taskkill', ['/pid', backend.pid, '/f', '/t']);
      if (frontend.pid) spawn('taskkill', ['/pid', frontend.pid, '/f', '/t']);
    } else {
      backend.kill('SIGTERM');
      frontend.kill('SIGTERM');
    }
  } catch (err) {
    // Ignore errors during force shutdown
  }
  
  // Wait a moment for processes to die
  setTimeout(() => {
    process.exit(0);
  }, 500);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

backend.on('exit', (code) => {
  if (!isCleaningUp) {
    console.log(`\x1b[31mBackend exited with code ${code}\x1b[0m`);
    cleanup();
  }
});

frontend.on('exit', (code) => {
  if (!isCleaningUp) {
    console.log(`\x1b[31mFrontend exited with code ${code}\x1b[0m`);
    cleanup();
  }
});
