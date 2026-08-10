#!/usr/bin/env node

import { execFile, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants as fsConstants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const ROOT = process.cwd();
const PROJECT = 'call-e-your-code-is-calling';
const DEV = resolve(ROOT, '.dev');
const PID_DIRECTORY = resolve(DEV, 'pids');
const LOG_DIRECTORY = resolve(DEV, 'logs');
const LOCK_FILE = resolve(DEV, 'lifecycle.lock');
const LOCK_OWNER_FILE = resolve(DEV, 'lifecycle.lock.owner.json');
const LOCK_TEST_ENVIRONMENT_FLAG = 'CALL_E_LIFECYCLE_LOCK_TEST';
const LOCK_WRAPPER_TOKEN_ENVIRONMENT_KEY = 'CALL_E_LIFECYCLE_LOCK_WRAPPER_TOKEN';
const IS_LIFECYCLE_LOCK_TEST =
  process.env[LOCK_TEST_ENVIRONMENT_FLAG] === '1' &&
  (process.argv[2] === 'lock-test' ||
    (process.argv[2] === '__lock-held' && process.argv[3] === 'test'));
const EXPECTED_PORTS = Object.freeze({
  operator: 4150,
  api: 4151,
  fakeCalle: 4152,
  worker: 4153,
  testHarness: 4154,
  postgres: 4155,
  otelHealth: 4156,
  otelHttp: 4157,
});
const PROCESS_NAMES = Object.freeze(['operator', 'api', 'fake-calle', 'worker', 'test-harness']);
const CONTAINER_NAMES = Object.freeze(['postgres', 'otel-collector']);
const COMPOSE_FILE = resolve(ROOT, 'compose.yaml');
const PORTS_FILE = resolve(ROOT, 'ports.env');
const CONTAINER_CONTRACTS = Object.freeze({
  postgres: Object.freeze({
    containerName: `${PROJECT}-postgres`,
    image:
      'postgres:18.4-bookworm@sha256:882236b897e39051d2368c5ccc6cda944904723506b2dfc97f2a8f5bc9afa382',
    ports: Object.freeze({ '5432/tcp': Object.freeze({ hostIp: '127.0.0.1', hostPort: '4155' }) }),
  }),
  'otel-collector': Object.freeze({
    containerName: `${PROJECT}-otel-collector`,
    image:
      'otel/opentelemetry-collector:0.158.0@sha256:5b97e6e3550ec6e48a71dba6f6304d349a293af8df4ee1f51da67be94fce2ecd',
    ports: Object.freeze({
      '13133/tcp': Object.freeze({ hostIp: '127.0.0.1', hostPort: '4156' }),
      '4318/tcp': Object.freeze({ hostIp: '127.0.0.1', hostPort: '4157' }),
    }),
  }),
});
const APP_VERSION = IS_LIFECYCLE_LOCK_TEST ? 'lifecycle-lock-test' : computeSourceRevision();
const execFileAsync = promisify(execFile);

function computeSourceRevision() {
  const head = readCommand(['git', 'rev-parse', '--short=12', 'HEAD']).trim() || 'uncommitted';
  const listed = spawnSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: ROOT, encoding: 'buffer', stdio: 'pipe' },
  );
  if (listed.status !== 0 || !Buffer.isBuffer(listed.stdout)) {
    fail('SOURCE_REVISION_FAILED', 'Unable to enumerate repository source files.');
  }
  const digest = createHash('sha256');
  const files = listed.stdout.toString('utf8').split('\0').filter(Boolean).sort();
  for (const file of files) {
    const absolute = resolve(ROOT, file);
    if (!existsSync(absolute) || !lstatSync(absolute).isFile()) continue;
    digest.update(file);
    digest.update('\0');
    digest.update(readFileSync(absolute));
    digest.update('\0');
  }
  return `${head}-${digest.digest('hex').slice(0, 16)}`;
}

function out(message) {
  process.stdout.write(`${message}\n`);
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    stdio: options.capture === false ? 'inherit' : 'pipe',
    timeout: 120_000,
    ...options,
  });
  if (result.status !== 0) {
    const stderr = typeof result.stderr === 'string' ? result.stderr.trim() : '';
    fail(
      'COMMAND_FAILED',
      `${command} ${args.join(' ')} failed${stderr.length > 0 ? `: ${stderr}` : ''}`,
    );
  }
  return typeof result.stdout === 'string' ? result.stdout : '';
}

function readCommand(commandAndArgs) {
  const [command, ...args] = commandAndArgs;
  if (command === undefined) return '';
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 10_000,
  });
  return result.status === 0 && typeof result.stdout === 'string' ? result.stdout : '';
}

function compose(args, options = {}) {
  return runCommand('docker', composeArguments(args), {
    ...options,
    env: composeEnvironment(),
  });
}

function composeArguments(args) {
  return [
    'compose',
    '--project-name',
    PROJECT,
    '--file',
    COMPOSE_FILE,
    '--env-file',
    PORTS_FILE,
    ...args,
  ];
}

function composeEnvironment() {
  const composeKeys = new Set([
    'COMPOSE_FILE',
    'COMPOSE_PATH_SEPARATOR',
    'COMPOSE_PROFILES',
    'COMPOSE_PROJECT_NAME',
  ]);
  return Object.fromEntries(Object.entries(process.env).filter(([name]) => !composeKeys.has(name)));
}

function ensureRuntimeDirectories() {
  for (const path of [
    DEV,
    PID_DIRECTORY,
    LOG_DIRECTORY,
    resolve(DEV, 'tmp'),
    resolve(DEV, 'cache'),
    resolve(DEV, 'pw-profile'),
  ]) {
    if (existsSync(path)) {
      const status = lstatSync(path);
      if (status.isSymbolicLink() || !status.isDirectory() || realpathSync(path) !== path) {
        fail('DEV_PATH_UNSAFE', `Runtime path must be a real repository directory: ${path}`);
      }
    } else {
      mkdirSync(path, { mode: 0o700 });
    }
  }
}

function parsePortsFile() {
  const raw = readFileSync(resolve(ROOT, 'ports.env'), 'utf8');
  const parsed = new Map();
  for (const line of raw.split(/\r?\n/u)) {
    const normalized = line.trim();
    if (normalized === '' || normalized.startsWith('#')) continue;
    const match = /^PORT_(\d+)=(\d+)(?:\s+#.*)?$/u.exec(normalized);
    if (match === null) fail('PORT_CONTRACT_INVALID', `Malformed ports.env entry: ${normalized}`);
    const key = `PORT_${match[1]}`;
    if (parsed.has(key)) fail('PORT_CONTRACT_INVALID', `Duplicate ports.env entry: ${key}`);
    parsed.set(key, Number.parseInt(match[2], 10));
  }
  const expected = new Map([
    ['PORT_0', EXPECTED_PORTS.operator],
    ['PORT_1', EXPECTED_PORTS.api],
    ['PORT_2', EXPECTED_PORTS.fakeCalle],
    ['PORT_3', EXPECTED_PORTS.worker],
    ['PORT_4', EXPECTED_PORTS.testHarness],
    ['PORT_5', EXPECTED_PORTS.postgres],
    ['PORT_6', EXPECTED_PORTS.otelHealth],
    ['PORT_7', EXPECTED_PORTS.otelHttp],
  ]);
  for (const [key, expectedPort] of expected) {
    if (parsed.get(key) !== expectedPort) {
      fail('PORT_CONTRACT_INVALID', `${key} must equal ${expectedPort} in ports.env.`);
    }
  }
  if (parsed.size !== expected.size || [...parsed.keys()].some((key) => !expected.has(key))) {
    fail('PORT_CONTRACT_INVALID', 'ports.env must declare exactly PORT_0 through PORT_7.');
  }
  const ports = [...parsed.values()];
  if (new Set(ports).size !== ports.length || ports.some((port) => port < 4150 || port > 4159)) {
    fail('PORT_CONTRACT_INVALID', 'Every declared port must be unique and inside 4150-4159.');
  }
}

function requireTool(command) {
  if (
    spawnSync('sh', ['-c', 'command -v "$1" >/dev/null 2>&1', 'sh', command], {
      stdio: 'ignore',
      timeout: 5_000,
    }).status !== 0
  ) {
    fail('TOOL_MISSING', `Required tool is unavailable: ${command}`);
  }
}

function readProcessMetadata(name) {
  const file = resolve(PID_DIRECTORY, `${name}.json`);
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    fail('OWNERSHIP_METADATA_INVALID', `Invalid process ownership metadata: ${file}`);
  }
}

function processSnapshot(pid) {
  const result = spawnSync(
    'ps',
    ['-p', String(pid), '-o', 'pid=', '-o', 'pgid=', '-o', 'lstart=', '-o', 'command='],
    { encoding: 'utf8', stdio: 'pipe', timeout: 5_000 },
  );
  if (result.status !== 0 || typeof result.stdout !== 'string' || result.stdout.trim() === '') {
    return undefined;
  }
  const output = result.stdout.trim();
  const match = /^(\d+)\s+(\d+)\s+(.{24})\s+(.+)$/u.exec(output);
  if (match === null) return undefined;
  return {
    pid: Number.parseInt(match[1], 10),
    processGroupId: Number.parseInt(match[2], 10),
    startedAt: match[3].trim(),
    command: match[4],
  };
}

function validateOwnedProcess(metadata) {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    typeof metadata.pid !== 'number' ||
    typeof metadata.processGroupId !== 'number' ||
    typeof metadata.startedAt !== 'string' ||
    typeof metadata.commandMarker !== 'string' ||
    metadata.project !== PROJECT ||
    metadata.processGroupId !== metadata.pid
  ) {
    return false;
  }
  const snapshot = processSnapshot(metadata.pid);
  if (snapshot === undefined) return false;
  return (
    snapshot.processGroupId === metadata.pid &&
    snapshot.startedAt === metadata.startedAt &&
    snapshot.command.includes(metadata.commandMarker)
  );
}

function processGroupPids(processGroupId) {
  const result = spawnSync('ps', ['-axo', 'pid=', '-o', 'pgid='], {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 5_000,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') return [];
  return result.stdout
    .split(/\r?\n/u)
    .map((line) => /^(\s*\d+)\s+(\d+)\s*$/u.exec(line))
    .filter((match) => match !== null && Number.parseInt(match[2], 10) === processGroupId)
    .map((match) => Number.parseInt(match[1], 10));
}

function readContainerMetadata(name) {
  const file = resolve(PID_DIRECTORY, `${name}.container.json`);
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    fail('OWNERSHIP_METADATA_INVALID', `Invalid container ownership metadata: ${file}`);
  }
}

function containerSnapshot(id) {
  const result = spawnSync('docker', ['inspect', id], {
    encoding: 'utf8',
    env: composeEnvironment(),
    stdio: 'pipe',
    timeout: 20_000,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') return undefined;
  try {
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : undefined;
  } catch {
    return undefined;
  }
}

function publishedPortBindings(snapshot) {
  const bindings = snapshot.HostConfig?.PortBindings;
  if (typeof bindings !== 'object' || bindings === null) return [];
  return Object.entries(bindings)
    .flatMap(([containerPort, published]) =>
      Array.isArray(published)
        ? published.map((binding) => ({
            containerPort,
            hostIp: binding.HostIp,
            hostPort: binding.HostPort,
          }))
        : [],
    )
    .sort((left, right) =>
      `${left.containerPort}:${left.hostIp}:${left.hostPort}`.localeCompare(
        `${right.containerPort}:${right.hostIp}:${right.hostPort}`,
      ),
    );
}

function containerRecord(name, id, snapshot) {
  const labels = snapshot.Config?.Labels;
  return {
    configFiles: labels?.['com.docker.compose.project.config_files'],
    configHash: labels?.['com.docker.compose.config-hash'],
    containerName: snapshot.Name,
    createdAt: snapshot.Created,
    id,
    image: snapshot.Config?.Image,
    name,
    project: labels?.['com.docker.compose.project'],
    publishedPorts: publishedPortBindings(snapshot),
    recordedAt: new Date().toISOString(),
    service: labels?.['com.docker.compose.service'],
    workingDirectory: labels?.['com.docker.compose.project.working_dir'],
  };
}

function validateRecordedContainer(metadata, { requireRunning = true } = {}) {
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    typeof metadata.id !== 'string' ||
    typeof metadata.name !== 'string' ||
    typeof metadata.createdAt !== 'string' ||
    typeof metadata.configHash !== 'string' ||
    typeof metadata.containerName !== 'string' ||
    typeof metadata.image !== 'string' ||
    !Array.isArray(metadata.publishedPorts) ||
    metadata.project !== PROJECT ||
    metadata.service !== metadata.name ||
    metadata.configFiles !== COMPOSE_FILE ||
    metadata.workingDirectory !== ROOT
  ) {
    return false;
  }
  const snapshot = containerSnapshot(metadata.id);
  if (snapshot === undefined) return false;
  const labels = snapshot.Config?.Labels;
  return !(
    snapshot.Id !== metadata.id ||
    snapshot.Created !== metadata.createdAt ||
    snapshot.Name !== metadata.containerName ||
    snapshot.Config?.Image !== metadata.image ||
    labels?.['com.docker.compose.config-hash'] !== metadata.configHash ||
    labels?.['com.docker.compose.project'] !== metadata.project ||
    labels?.['com.docker.compose.service'] !== metadata.service ||
    labels?.['com.docker.compose.project.config_files'] !== metadata.configFiles ||
    labels?.['com.docker.compose.project.working_dir'] !== metadata.workingDirectory ||
    JSON.stringify(publishedPortBindings(snapshot)) !== JSON.stringify(metadata.publishedPorts) ||
    (requireRunning && snapshot.State?.Running !== true)
  );
}

function matchesDesiredContainerContract(metadata) {
  const contract = CONTAINER_CONTRACTS[metadata.name];
  if (contract === undefined) return false;
  const desiredPorts = Object.entries(contract.ports)
    .map(([containerPort, binding]) => ({
      containerPort,
      hostIp: binding.hostIp,
      hostPort: binding.hostPort,
    }))
    .sort((left, right) =>
      `${left.containerPort}:${left.hostIp}:${left.hostPort}`.localeCompare(
        `${right.containerPort}:${right.hostIp}:${right.hostPort}`,
      ),
    );
  return (
    metadata.containerName === `/${contract.containerName}` &&
    metadata.image === contract.image &&
    JSON.stringify(metadata.publishedPorts) === JSON.stringify(desiredPorts)
  );
}

function processGroupForPid(pid) {
  const result = spawnSync('ps', ['-p', String(pid), '-o', 'pgid='], {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 5_000,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') return undefined;
  const parsed = Number.parseInt(result.stdout.trim(), 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function listenerPids(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], {
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 5_000,
  });
  if (result.status !== 0 && result.status !== 1) {
    fail('PORT_PROBE_FAILED', `lsof failed while probing port ${port}.`);
  }
  return typeof result.stdout === 'string'
    ? result.stdout
        .split(/\s+/u)
        .filter(Boolean)
        .map((value) => Number.parseInt(value, 10))
        .filter(Number.isInteger)
    : [];
}

function isOwnedListener(port, pid, ownedContainerPorts) {
  const groupId = processGroupForPid(pid);
  for (const name of PROCESS_NAMES) {
    const metadata = readProcessMetadata(name);
    if (metadata !== undefined && validateOwnedProcess(metadata) && groupId === metadata.pid)
      return true;
  }

  return ownedContainerPorts.has(port);
}

function collectOwnedContainerPorts() {
  const ports = new Set();
  for (const name of CONTAINER_NAMES) {
    const metadata = readContainerMetadata(name);
    if (metadata === undefined || !validateRecordedContainer(metadata)) continue;
    for (const binding of metadata.publishedPorts) {
      if (binding.hostIp === '127.0.0.1') ports.add(Number(binding.hostPort));
    }
  }
  return ports;
}

function assertPortsAvailableOrOwned() {
  const ownedContainerPorts = collectOwnedContainerPorts();
  for (let port = 4150; port <= 4159; port += 1) {
    const pids = listenerPids(port);
    const foreign = pids.filter((pid) => !isOwnedListener(port, pid, ownedContainerPorts));
    if (foreign.length > 0) {
      const holder = readCommand(['lsof', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN']).trim();
      fail(
        'FOREIGN_PORT_HOLDER',
        `Port ${port} is held by a process this repository does not own.\n${holder}`,
      );
    }
  }
}

function assertStaticIsolation() {
  const composeSource = readFileSync(resolve(ROOT, 'compose.yaml'), 'utf8');
  const hostMappings = [...composeSource.matchAll(/-\s+['"]([^'"]+):\d+['"]/gu)].map(
    (match) => match[1],
  );
  if (
    hostMappings.length < 3 ||
    hostMappings.some((mapping) => !mapping.startsWith('127.0.0.1:'))
  ) {
    fail('HOST_BINDING_INVALID', 'Every Compose host mapping must bind explicitly to 127.0.0.1.');
  }
  if (!composeSource.includes(`name: ${PROJECT}`)) {
    fail('NAMESPACE_INVALID', 'compose.yaml must declare the repository project name.');
  }
  const playwrightSource = readFileSync(resolve(ROOT, 'playwright.config.ts'), 'utf8');
  if (
    !playwrightSource.includes('http://127.0.0.1:4150') ||
    !playwrightSource.includes('http://127.0.0.1:4154')
  ) {
    fail(
      'PLAYWRIGHT_PORT_INVALID',
      'Playwright must use the operator and semantic harness ports explicitly.',
    );
  }
}

function assertRenderedComposeIsolation() {
  let rendered;
  try {
    rendered = JSON.parse(compose(['config', '--format', 'json']));
  } catch {
    fail('COMPOSE_CONFIG_INVALID', 'The pinned Compose configuration could not be rendered.');
  }
  const expected = [
    ['postgres', 5432, 4155],
    ['otel-collector', 13133, 4156],
    ['otel-collector', 4318, 4157],
  ];
  const serviceNames = Object.keys(rendered.services ?? {}).sort();
  if (serviceNames.join(',') !== 'otel-collector,postgres') {
    fail('COMPOSE_CONFIG_INVALID', 'Compose may define only postgres and otel-collector.');
  }
  for (const [serviceName, target, published] of expected) {
    const ports = rendered.services?.[serviceName]?.ports;
    const match = Array.isArray(ports)
      ? ports.find(
          (port) =>
            Number(port.target) === target &&
            Number(port.published) === published &&
            port.host_ip === '127.0.0.1' &&
            port.protocol === 'tcp',
        )
      : undefined;
    if (match === undefined) {
      fail(
        'COMPOSE_CONFIG_INVALID',
        `${serviceName} must publish ${target} only as 127.0.0.1:${published}.`,
      );
    }
  }
  const allPublishedPorts = serviceNames.flatMap((name) => rendered.services[name].ports ?? []);
  if (
    allPublishedPorts.length !== expected.length ||
    allPublishedPorts.some(
      (port) =>
        port.host_ip !== '127.0.0.1' ||
        Number(port.published) < 4150 ||
        Number(port.published) > 4159,
    )
  ) {
    fail('COMPOSE_CONFIG_INVALID', 'Rendered Compose ports escaped the loopback 4150-4159 block.');
  }
}

function assertVersions() {
  if (process.version !== 'v24.19.0') {
    fail('NODE_VERSION_UNSUPPORTED', `Node 24.19.0 is required; found ${process.version}.`);
  }
  const pnpmVersion = runCommand('pnpm', ['--version']).trim();
  if (pnpmVersion !== '11.20.0') {
    fail('PNPM_VERSION_UNSUPPORTED', `pnpm 11.20.0 is required; found ${pnpmVersion}.`);
  }
}

function preflight() {
  if (!existsSync(resolve(ROOT, 'package.json')) || !existsSync(resolve(ROOT, 'GOAL.md'))) {
    fail('REPOSITORY_ROOT_INVALID', 'Run the lifecycle from this repository root.');
  }
  ensureRuntimeDirectories();
  for (const tool of ['docker', 'git', 'lsof', 'node', 'pnpm', 'ps']) requireTool(tool);
  if (spawnSync('docker', ['info'], { stdio: 'ignore', timeout: 90_000 }).status !== 0) {
    fail('DOCKER_UNAVAILABLE', 'Docker is required and its daemon is unavailable.');
  }
  if (
    spawnSync('git', ['check-ignore', '--quiet', '.dev/probe'], {
      cwd: ROOT,
      stdio: 'ignore',
      timeout: 5_000,
    }).status !== 0
  ) {
    fail('DEV_DIRECTORY_TRACKED', '.dev/ must be ignored by Git.');
  }
  if (!existsSync(resolve(ROOT, 'node_modules/.bin/tsx'))) {
    fail('DEPENDENCIES_MISSING', 'Locked dependencies are absent; run pnpm bootstrap first.');
  }
  parsePortsFile();
  assertVersions();
  assertStaticIsolation();
  assertRenderedComposeIsolation();
  assertPortsAvailableOrOwned();
  out('dev:preflight PASS — toolchain, namespace, port, ownership, and loopback checks are green.');
}

function atomicWriteJson(path, value) {
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function lifecycleLockTool() {
  if (process.platform === 'darwin') return 'lockf';
  if (process.platform === 'linux') return 'flock';
  fail(
    'LIFECYCLE_LOCK_UNSUPPORTED',
    `Kernel-backed lifecycle locking is unsupported on ${process.platform}.`,
  );
}

function ensureLifecycleLockFile() {
  ensureRuntimeDirectories();
  if (existsSync(LOCK_FILE)) {
    const status = lstatSync(LOCK_FILE);
    if (status.isSymbolicLink() || !status.isFile() || realpathSync(LOCK_FILE) !== LOCK_FILE) {
      fail('LIFECYCLE_LOCK_PATH_INVALID', 'Lifecycle lock must be a real repository file.');
    }
    return;
  }

  let descriptor;
  try {
    descriptor = openSync(
      LOCK_FILE,
      fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_RDWR | fsConstants.O_NOFOLLOW,
      0o600,
    );
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      ensureLifecycleLockFile();
      return;
    }
    throw error;
  }
  closeSync(descriptor);
}

function lifecycleLockCommand(operation, token, operationArguments) {
  const innerCommand = [
    process.execPath,
    resolve(ROOT, 'scripts/dev-lifecycle.mjs'),
    '__lock-held',
    operation,
    token,
    ...operationArguments,
  ];
  if (process.platform === 'darwin') {
    return ['lockf', ['-k', '-t', '0', LOCK_FILE, ...innerCommand]];
  }
  return [
    'flock',
    ['--exclusive', '--nonblock', '--conflict-exit-code', '75', LOCK_FILE, ...innerCommand],
  ];
}

function runWithLifecycleLock(operation, operationArguments = []) {
  ensureLifecycleLockFile();
  const tool = lifecycleLockTool();
  requireTool(tool);
  const token = randomHex(16);
  const [command, args] = lifecycleLockCommand(operation, token, operationArguments);
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, [LOCK_WRAPPER_TOKEN_ENVIRONMENT_KEY]: token },
    stdio: 'inherit',
  });
  if (result.status === 75) {
    fail('LIFECYCLE_LOCKED', 'Another repository lifecycle operation is already active.');
  }
  if (result.status === null) {
    fail(
      'LIFECYCLE_LOCK_FAILED',
      `Lifecycle lock wrapper failed${result.signal === null ? '' : ` with ${result.signal}`}.`,
    );
  }
  return result.status;
}

function writeLifecycleLockOwner(operation, token) {
  const snapshot = processSnapshot(process.pid);
  if (snapshot === undefined) {
    fail('LIFECYCLE_LOCK_FAILED', 'Cannot snapshot lifecycle lock owner.');
  }
  atomicWriteJson(LOCK_OWNER_FILE, {
    acquiredAt: new Date().toISOString(),
    operation,
    pid: process.pid,
    project: PROJECT,
    startedAt: snapshot.startedAt,
    token,
  });
}

async function runKernelLockedOperation(operation, token, operationArguments) {
  const lockTool = lifecycleLockTool();
  const wrapper = processSnapshot(process.ppid);
  const kernelWrapperPresent =
    wrapper !== undefined &&
    wrapper.command.includes(lockTool) &&
    wrapper.command.includes(LOCK_FILE) &&
    wrapper.command.includes('__lock-held') &&
    wrapper.command.includes(token);
  if (
    token.length !== 32 ||
    process.env[LOCK_WRAPPER_TOKEN_ENVIRONMENT_KEY] !== token ||
    !kernelWrapperPresent
  ) {
    fail('LIFECYCLE_LOCK_INVALID', 'The internal lifecycle lock token is invalid.');
  }
  writeLifecycleLockOwner(operation, token);
  try {
    if (operation === 'up') await start();
    else if (operation === 'down') await stop();
    else if (operation === 'test') await runLifecycleLockTestOperation(operationArguments);
    else fail('LIFECYCLE_LOCK_INVALID', `Unknown locked lifecycle operation: ${operation}`);
  } finally {
    rmSync(LOCK_OWNER_FILE, { force: true });
  }
}

async function runLifecycleLockTestOperation(operationArguments) {
  if (process.env[LOCK_TEST_ENVIRONMENT_FLAG] !== '1') {
    fail('USAGE', 'Lifecycle lock test operation is disabled.');
  }
  const mode = operationArguments[0];
  out('lifecycle-lock:test acquired');
  if (mode === 'crash') process.exit(86);
  if (mode === 'hold-until') {
    const releaseFileName = operationArguments[1];
    if (
      releaseFileName === undefined ||
      !/^lifecycle-lock-release-[a-z0-9-]+$/u.test(releaseFileName)
    ) {
      fail('USAGE', 'Lifecycle lock test release file name is invalid.');
    }
    const releaseFile = resolve(DEV, 'tmp', releaseFileName);
    const deadline = Date.now() + 60_000;
    while (!existsSync(releaseFile)) {
      if (Date.now() >= deadline)
        fail('LIFECYCLE_LOCK_TEST_TIMEOUT', 'Lifecycle lock test timed out.');
      await sleep(25);
    }
    return;
  }
  if (mode !== 'hold') fail('USAGE', 'Lifecycle lock test mode must be hold or crash.');
  const milliseconds = Number.parseInt(operationArguments[1] ?? '', 10);
  if (!Number.isInteger(milliseconds) || milliseconds < 0 || milliseconds > 5_000) {
    fail('USAGE', 'Lifecycle lock test hold must be between 0 and 5000 milliseconds.');
  }
  await sleep(milliseconds);
}

async function rollbackJustSpawnedProcess(pid) {
  const snapshot = processSnapshot(pid);
  if (snapshot === undefined || snapshot.processGroupId !== pid) return;
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    return;
  }
  if (!(await waitForProcessGroupExit(pid, 2_000))) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      return;
    }
    await waitForProcessGroupExit(pid, 1_000);
  }
}

async function spawnOwned(name, command, args, environment, commandMarker) {
  const logPath = resolve(LOG_DIRECTORY, `${name}.log`);
  const logFd = openSync(
    logPath,
    fsConstants.O_APPEND | fsConstants.O_CREAT | fsConstants.O_NOFOLLOW | fsConstants.O_WRONLY,
    0o600,
  );
  const child = spawn(command, args, {
    cwd: ROOT,
    detached: true,
    env: { ...process.env, ...environment },
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  closeSync(logFd);
  await sleep(400);
  const snapshot = processSnapshot(child.pid);
  if (
    snapshot === undefined ||
    snapshot.processGroupId !== child.pid ||
    !snapshot.command.includes(commandMarker)
  ) {
    await rollbackJustSpawnedProcess(child.pid);
    fail('PROCESS_START_FAILED', `${name} did not remain alive; inspect ${logPath}.`);
  }
  try {
    atomicWriteJson(resolve(PID_DIRECTORY, `${name}.json`), {
      name,
      pid: child.pid,
      project: PROJECT,
      processGroupId: child.pid,
      startedAt: snapshot.startedAt,
      commandMarker,
      logPath,
    });
  } catch (error) {
    await rollbackJustSpawnedProcess(child.pid);
    throw error;
  }
}

function recordContainer(name, provisionalRecords) {
  const id = compose(['ps', '--all', '--quiet', name]).trim();
  if (id === '') fail('CONTAINER_START_FAILED', `${name} did not produce a container ID.`);
  const snapshot = containerSnapshot(id);
  if (snapshot === undefined || typeof snapshot.Created !== 'string') {
    fail('CONTAINER_START_FAILED', `${name} could not be inspected after creation.`);
  }
  const record = containerRecord(name, id, snapshot);
  provisionalRecords.push(record);
  if (!validateRecordedContainer(record) || !matchesDesiredContainerContract(record)) {
    fail('CONTAINER_OWNERSHIP_INVALID', `${name} failed the exact container identity contract.`);
  }
  atomicWriteJson(resolve(PID_DIRECTORY, `${record.name}.container.json`), record);
}

function discoverProvisionalContainers(provisionalRecords) {
  for (const name of CONTAINER_NAMES) {
    if (provisionalRecords.some((record) => record.name === name)) continue;
    const result = spawnSync('docker', composeArguments(['ps', '--all', '--quiet', name]), {
      cwd: ROOT,
      encoding: 'utf8',
      env: composeEnvironment(),
      stdio: 'pipe',
      timeout: 10_000,
    });
    const id = result.status === 0 ? result.stdout.trim() : '';
    if (id === '') continue;
    const snapshot = containerSnapshot(id);
    if (snapshot === undefined) continue;
    const record = containerRecord(name, id, snapshot);
    if (validateRecordedContainer(record, { requireRunning: false })) {
      provisionalRecords.push(record);
    }
  }
}

function applyMigrations() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = spawnSync(
      'docker',
      composeArguments([
        'exec',
        '--no-TTY',
        'postgres',
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'call_e_your_code_is_calling',
        '-d',
        'call_e_your_code_is_calling',
      ]),
      { cwd: ROOT, env: composeEnvironment(), stdio: 'ignore', timeout: 3_000 },
    );
    if (result.status === 0) break;
    if (Date.now() + 500 >= deadline)
      fail('POSTGRES_NOT_READY', 'PostgreSQL did not become ready.');
    spawnSync('sleep', ['0.5']);
  }
  compose([
    'exec',
    '--no-TTY',
    'postgres',
    'psql',
    '--set',
    'ON_ERROR_STOP=1',
    '--username',
    'call_e_your_code_is_calling',
    '--dbname',
    'call_e_your_code_is_calling',
    '--file',
    '/migrations/0001_runtime_readiness.sql',
  ]);
}

function baseEnvironment() {
  return {
    API_INTERNAL_URL: `http://127.0.0.1:${EXPECTED_PORTS.api}`,
    API_PORT: String(EXPECTED_PORTS.api),
    APP_MODE: 'local',
    APP_VERSION,
    CALLE_PROVIDER_MODE: 'fake',
    DATABASE_URL:
      'postgresql://call_e_your_code_is_calling:local-development-only@127.0.0.1:4155/call_e_your_code_is_calling',
    FAKE_CALLE_URL: `http://127.0.0.1:${EXPECTED_PORTS.fakeCalle}`,
    FAKE_PORT: String(EXPECTED_PORTS.fakeCalle),
    HARNESS_PORT: String(EXPECTED_PORTS.testHarness),
    HOST: '127.0.0.1',
    NODE_ENV: 'development',
    OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${EXPECTED_PORTS.otelHttp}`,
    OTEL_HEALTH_URL: `http://127.0.0.1:${EXPECTED_PORTS.otelHealth}`,
    OPERATOR_INTERNAL_URL: `http://127.0.0.1:${EXPECTED_PORTS.operator}`,
    WORKER_INTERNAL_URL: `http://127.0.0.1:${EXPECTED_PORTS.worker}`,
    WORKER_PORT: String(EXPECTED_PORTS.worker),
  };
}

async function start() {
  preflight();
  const provisionalContainerRecords = [];
  try {
    const liveRecords = PROCESS_NAMES.some((name) => {
      const metadata = readProcessMetadata(name);
      return metadata !== undefined && validateOwnedProcess(metadata);
    });
    if (liveRecords) {
      try {
        await health({ timeoutMilliseconds: 5_000, quiet: true });
        out('dev:up PASS — repository-owned services were already ready.');
        return;
      } catch {
        await stopOwnedRuntime();
      }
    }

    compose(['up', '--detach', 'postgres'], { capture: false });
    recordContainer('postgres', provisionalContainerRecords);
    compose(['up', '--detach', 'otel-collector'], { capture: false });
    recordContainer('otel-collector', provisionalContainerRecords);
    applyMigrations();

    const environment = baseEnvironment();
    const tsx = resolve(ROOT, 'node_modules/.bin/tsx');
    await spawnOwned(
      'fake-calle',
      tsx,
      ['tests/fake-calle/server.ts'],
      environment,
      'tests/fake-calle/server.ts',
    );
    await spawnOwned(
      'api',
      tsx,
      ['apps/operator/src/server/api.ts'],
      environment,
      'apps/operator/src/server/api.ts',
    );
    await spawnOwned(
      'worker',
      tsx,
      ['apps/operator/src/server/worker.ts'],
      environment,
      'apps/operator/src/server/worker.ts',
    );
    await spawnOwned(
      'operator',
      process.execPath,
      [
        resolve(ROOT, 'apps/operator/node_modules/next/dist/bin/next'),
        'dev',
        'apps/operator',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(EXPECTED_PORTS.operator),
      ],
      environment,
      'next/dist/bin/next',
    );
    await spawnOwned(
      'test-harness',
      tsx,
      ['tests/harness/server.ts'],
      environment,
      'tests/harness/server.ts',
    );
    await health({ timeoutMilliseconds: 180_000, quiet: true });
    out('dev:up PASS — every repository-owned service started and reached semantic readiness.');
  } catch (error) {
    discoverProvisionalContainers(provisionalContainerRecords);
    try {
      await stopOwnedRuntime({ provisionalContainerRecords });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'dev:up failed and exact-resource rollback also failed',
        { cause: cleanupError },
      );
    }
    throw error;
  }
}

async function waitForProcessGroupExit(processGroupId, milliseconds) {
  const deadline = Date.now() + milliseconds;
  while (Date.now() < deadline) {
    if (processGroupPids(processGroupId).length === 0) return true;
    await sleep(100);
  }
  return processGroupPids(processGroupId).length === 0;
}

async function stopProcess(name) {
  const path = resolve(PID_DIRECTORY, `${name}.json`);
  const metadata = readProcessMetadata(name);
  if (metadata === undefined) return;
  if (!validateOwnedProcess(metadata)) {
    if (
      processSnapshot(metadata.pid) !== undefined ||
      (typeof metadata.processGroupId === 'number' &&
        processGroupPids(metadata.processGroupId).length > 0)
    ) {
      fail(
        'PROCESS_OWNERSHIP_MISMATCH',
        `Refusing to stop unverified PID ${metadata.pid} for ${name}.`,
      );
    }
    rmSync(path, { force: true });
    return;
  }
  try {
    process.kill(-metadata.processGroupId, 'SIGTERM');
  } catch (error) {
    if (processGroupPids(metadata.processGroupId).length > 0) throw error;
  }
  if (!(await waitForProcessGroupExit(metadata.processGroupId, 5_000))) {
    try {
      process.kill(-metadata.processGroupId, 'SIGKILL');
    } catch (error) {
      if (processGroupPids(metadata.processGroupId).length > 0) throw error;
    }
    if (!(await waitForProcessGroupExit(metadata.processGroupId, 2_000))) {
      fail(
        'PROCESS_STOP_FAILED',
        `Owned process group ${metadata.processGroupId} for ${name} did not exit.`,
      );
    }
  }
  rmSync(path, { force: true });
}

async function stopContainers(provisionalContainerRecords = []) {
  const records = [];
  for (const name of CONTAINER_NAMES) {
    const metadata = readContainerMetadata(name);
    if (metadata !== undefined) records.push(metadata);
  }
  for (const record of provisionalContainerRecords) {
    if (!records.some((candidate) => candidate.id === record.id)) records.push(record);
  }
  for (const metadata of records) {
    const metadataPath = resolve(PID_DIRECTORY, `${metadata.name}.container.json`);
    const snapshot = containerSnapshot(metadata.id);
    if (snapshot === undefined) {
      rmSync(metadataPath, { force: true });
      continue;
    }
    if (!validateRecordedContainer(metadata, { requireRunning: false })) {
      fail(
        'CONTAINER_OWNERSHIP_MISMATCH',
        `Refusing to stop unverified container ${metadata.id} for ${metadata.name}.`,
      );
    }
    if (snapshot.State?.Running === true) {
      runCommand('docker', ['stop', '--timeout', '10', metadata.id], {
        capture: false,
        env: composeEnvironment(),
      });
    }
    runCommand('docker', ['rm', metadata.id], {
      capture: false,
      env: composeEnvironment(),
    });
    rmSync(metadataPath, { force: true });
  }
}

async function stopOwnedRuntime({ provisionalContainerRecords = [] } = {}) {
  for (const name of [...PROCESS_NAMES].reverse()) await stopProcess(name);
  await stopContainers(provisionalContainerRecords);
}

async function stop() {
  ensureRuntimeDirectories();
  await stopOwnedRuntime();
  out('dev:down PASS — only validated repository-owned processes and containers were stopped.');
}

async function fetchReadiness(name, url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = await response.json();
    if (
      !response.ok ||
      typeof body !== 'object' ||
      body === null ||
      body.status !== 'ready' ||
      body.service !== name ||
      body.version !== APP_VERSION
    ) {
      return { ok: false, detail: `${name} returned a non-ready document` };
    }
    return { ok: true, detail: `${name} ready` };
  } catch (error) {
    return {
      ok: false,
      detail: `${name} unreachable: ${error instanceof Error ? error.message : 'error'}`,
    };
  }
}

async function checkPostgres() {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      composeArguments([
        'exec',
        '--no-TTY',
        'postgres',
        'psql',
        '--tuples-only',
        '--no-align',
        '--username',
        'call_e_your_code_is_calling',
        '--dbname',
        'call_e_your_code_is_calling',
        '--command',
        "SELECT version FROM app_schema_migrations WHERE version = '0001_runtime_readiness'",
      ]),
      {
        cwd: ROOT,
        encoding: 'utf8',
        env: composeEnvironment(),
        maxBuffer: 64 * 1024,
        timeout: 15_000,
      },
    );
    return {
      ok: stdout.trim() === '0001_runtime_readiness',
      detail: 'postgres authenticated schema query',
    };
  } catch (error) {
    return {
      ok: false,
      detail: `postgres readiness failed: ${error instanceof Error ? error.message : 'error'}`,
    };
  }
}

async function checkOtelCanary() {
  const collector = await fetchReadiness(
    'otel-collector',
    `http://127.0.0.1:${EXPECTED_PORTS.otelHealth}/`,
  );
  if (!collector.ok) {
    try {
      const response = await fetch(`http://127.0.0.1:${EXPECTED_PORTS.otelHealth}/`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) return collector;
    } catch {
      return collector;
    }
  }

  const token = `dev-health-${randomHex(16)}`;
  const nowNanoseconds = (BigInt(Date.now()) * 1_000_000n).toString();
  const response = await fetch(`http://127.0.0.1:${EXPECTED_PORTS.otelHttp}/v1/logs`, {
    body: JSON.stringify({
      resourceLogs: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'call-e-your-code-is-calling-health' } },
            ],
          },
          scopeLogs: [
            {
              scope: { name: 'dev-health' },
              logRecords: [
                {
                  timeUnixNano: nowNanoseconds,
                  severityText: 'INFO',
                  body: { stringValue: token },
                },
              ],
            },
          ],
        },
      ],
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    signal: AbortSignal.timeout(2_000),
  });
  if (!response.ok) return { ok: false, detail: `otel ingest returned ${response.status}` };
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    try {
      const { stdout, stderr } = await execFileAsync(
        'docker',
        composeArguments(['logs', '--no-color', '--tail', '200', 'otel-collector']),
        {
          cwd: ROOT,
          encoding: 'utf8',
          env: composeEnvironment(),
          maxBuffer: 256 * 1024,
          timeout: 15_000,
        },
      );
      if (`${stdout}${stderr}`.includes(token)) {
        return { ok: true, detail: 'otel health and end-to-end canary export' };
      }
    } catch (error) {
      return {
        ok: false,
        detail: `otel log verification failed: ${error instanceof Error ? error.message : 'error'}`,
      };
    }
    await sleep(150);
  }
  return { ok: false, detail: 'otel canary was not exported' };
}

function randomHex(bytes) {
  return crypto
    .getRandomValues(new Uint8Array(bytes))
    .reduce((value, byte) => `${value}${byte.toString(16).padStart(2, '0')}`, '');
}

function safeLogTail(name) {
  const path = resolve(LOG_DIRECTORY, `${name}.log`);
  if (!existsSync(path)) return '';
  const lines = readFileSync(path, 'utf8').split(/\r?\n/u).slice(-20);
  return lines
    .map((line) =>
      line.replace(
        /(authorization|password|token|api[_-]?key)\s*[=:]\s*[^\s,}]+/giu,
        '$1=[REDACTED]',
      ),
    )
    .join('\n');
}

async function health({ timeoutMilliseconds = 120_000, quiet = false } = {}) {
  ensureRuntimeDirectories();
  const deadline = Date.now() + timeoutMilliseconds;
  let results = [];
  while (Date.now() < deadline) {
    results = await Promise.all([
      fetchReadiness('operator', `http://127.0.0.1:${EXPECTED_PORTS.operator}/api/health`),
      fetchReadiness('api', `http://127.0.0.1:${EXPECTED_PORTS.api}/readyz`),
      fetchReadiness('fake-calle', `http://127.0.0.1:${EXPECTED_PORTS.fakeCalle}/readyz`),
      fetchReadiness('worker', `http://127.0.0.1:${EXPECTED_PORTS.worker}/readyz`),
      fetchReadiness('test-harness', `http://127.0.0.1:${EXPECTED_PORTS.testHarness}/readyz`),
      checkPostgres(),
      checkOtelCanary().catch((error) => ({
        ok: false,
        detail: `otel canary failed: ${error instanceof Error ? error.message : 'error'}`,
      })),
    ]);
    if (results.every((result) => result.ok)) {
      if (!quiet) {
        for (const result of results) out(`PASS ${result.detail}`);
        out('dev:health PASS — every allocated service passed semantic readiness.');
      }
      return;
    }
    await sleep(500);
  }
  const details = results
    .map((result) => `${result.ok ? 'PASS' : 'FAIL'} ${result.detail}`)
    .join('\n');
  const tails = PROCESS_NAMES.map((name) => `--- ${name}.log ---\n${safeLogTail(name)}`).join('\n');
  fail('HEALTH_TIMEOUT', `Semantic readiness timed out.\n${details}\n${tails}`);
}

async function main() {
  const command = process.argv[2];
  if (command === '__lock-held') {
    const operation = process.argv[3];
    const token = process.argv[4];
    if (operation === undefined || token === undefined) {
      fail('LIFECYCLE_LOCK_INVALID', 'The internal lifecycle lock invocation is invalid.');
    }
    await runKernelLockedOperation(operation, token, process.argv.slice(5));
    return;
  }
  if (command === 'preflight') preflight();
  else if (command === 'up' || command === 'down') {
    const status = runWithLifecycleLock(command);
    if (status !== 0) process.exitCode = status;
  } else if (command === 'lock-test') {
    if (process.env[LOCK_TEST_ENVIRONMENT_FLAG] !== '1') {
      fail('USAGE', 'Lifecycle lock test operation is disabled.');
    }
    const status = runWithLifecycleLock('test', process.argv.slice(3));
    if (status !== 0) process.exitCode = status;
  } else if (command === 'health') await health();
  else if (command === 'probe') {
    const url = process.argv[3];
    const service = process.argv[4];
    if (url === undefined || service === undefined) {
      fail('USAGE', 'probe requires a URL and expected service name');
    }
    const result = await fetchReadiness(service, url);
    if (!result.ok) fail('SEMANTIC_READINESS_FAILED', result.detail);
    out(`dev:probe PASS — ${result.detail}`);
  } else fail('USAGE', 'Usage: dev-lifecycle.mjs <preflight|up|down|health|probe>');
}

main().catch((error) => {
  const code = error instanceof Error && 'code' in error ? String(error.code) : 'UNEXPECTED_ERROR';
  const message = error instanceof Error ? error.message : 'Unknown lifecycle failure';
  process.stderr.write(`${code}: ${message}\n`);
  process.exitCode = 1;
});
