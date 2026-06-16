import { spawn } from 'node:child_process';
import process from 'node:process';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';

const services = [
  {
    name: 'backend',
    color: '\x1b[36m',
    cwd: 'backend',
    args: ['run', 'dev'],
  },
  {
    name: 'frontend',
    color: '\x1b[35m',
    cwd: 'frontend',
    args: ['run', 'dev'],
  },
];

const reset = '\x1b[0m';
const children = [];
let shuttingDown = false;

function prefixOutput(service, data, stream) {
  const text = data.toString();
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (!line && index === lines.length - 1) return;
    stream.write(`${service.color}[${service.name}]${reset} ${line}\n`);
  });
}

function stopAll(signal = 'SIGTERM') {
  if (shuttingDown) return;
  shuttingDown = true;

  children.forEach((child) => {
    if (!child.killed) child.kill(signal);
  });
}

services.forEach((service) => {
  const child = spawn(npmCommand, service.args, {
    cwd: service.cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isWindows,
  });

  children.push(child);

  child.stdout.on('data', (data) => prefixOutput(service, data, process.stdout));
  child.stderr.on('data', (data) => prefixOutput(service, data, process.stderr));

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`${service.color}[${service.name}]${reset} exited with ${reason}`);
    stopAll();
    process.exitCode = code ?? 1;
  });
});

process.on('SIGINT', () => {
  stopAll('SIGINT');
  process.exit();
});

process.on('SIGTERM', () => {
  stopAll('SIGTERM');
  process.exit();
});

