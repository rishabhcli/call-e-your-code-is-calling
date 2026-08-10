#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const violations = [];

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function discoverPackageFiles(directory) {
  const discovered = [];
  if (!existsSync(directory)) return discovered;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || ['.dev', '.next', 'dist', 'node_modules'].includes(entry.name)) {
      continue;
    }
    const child = join(directory, entry.name);
    const manifest = join(child, 'package.json');
    if (existsSync(manifest)) discovered.push(relative(root, manifest));
    discovered.push(...discoverPackageFiles(child));
  }
  return discovered;
}

const packageFiles = [
  'package.json',
  ...discoverPackageFiles(join(root, 'apps')),
  ...discoverPackageFiles(join(root, 'packages')),
].sort();
const externalDirectDependencies = new Map();

for (const file of packageFiles) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  for (const section of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (
        typeof version !== 'string' ||
        (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(version) && version !== 'workspace:*')
      ) {
        violations.push(`${file} ${section}.${name} is not an exact pin: ${String(version)}`);
        continue;
      }
      if (version === 'workspace:*') continue;
      const existing = externalDirectDependencies.get(name);
      if (existing !== undefined && existing !== version) {
        violations.push(`${name} has conflicting direct pins ${existing} and ${version}`);
      }
      externalDirectDependencies.set(name, version);
    }
  }
}

const register = readFileSync('DEPENDENCIES.md', 'utf8');
const directSection = register.split('## External direct npm dependencies\n')[1]?.split('\n## ')[0];
if (directSection === undefined) {
  violations.push('DEPENDENCIES.md is missing the external direct npm dependency table');
} else {
  const registered = new Map();
  for (const line of directSection.split(/\r?\n/u)) {
    if (!line.startsWith('| `')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 7) {
      violations.push(`Malformed dependency register row: ${line}`);
      continue;
    }
    const name = /^`([^`]+)`$/u.exec(cells[0])?.[1];
    const version = /^`([^`]+)`$/u.exec(cells[1])?.[1];
    if (name === undefined || version === undefined) {
      violations.push(`Dependency name and pin must use code formatting: ${line}`);
      continue;
    }
    if (registered.has(name)) violations.push(`Duplicate dependency register row for ${name}`);
    registered.set(name, version);
    for (const [index, field] of cells.entries()) {
      if (index < 2) continue;
      if (field.length < 3 || /^(?:n\/a|pending|tbd|unknown)$/iu.test(field)) {
        violations.push(`${name} has an incomplete dependency review field at column ${index + 1}`);
      }
    }
  }
  for (const [name, version] of externalDirectDependencies) {
    if (registered.get(name) !== version) {
      violations.push(
        `${name}@${version} is missing from the direct register or recorded at the wrong pin`,
      );
    }
  }
  for (const name of registered.keys()) {
    if (!externalDirectDependencies.has(name)) {
      violations.push(`${name} is registered as a direct npm dependency but is not direct`);
    }
  }
}

const compose = readFileSync('compose.yaml', 'utf8');
const images = new Set(
  [...compose.matchAll(/^\s*image:\s*['"]?([^'"\s#]+)['"]?(?:\s+#.*)?$/gmu)].map(
    (match) => match[1],
  ),
);
for (const image of images) {
  if (!/^[^@\s]+@sha256:[0-9a-f]{64}$/u.test(image)) {
    violations.push(`compose.yaml image is not pinned by a full SHA-256 digest: ${image}`);
  }
  if (!register.includes(`\`${image}\``)) {
    violations.push(`DEPENDENCIES.md is missing full image pin ${image}`);
  }
}
if (images.size === 0) violations.push('compose.yaml contains no registered runtime images');

const actions = new Map();
const workflowDirectory = join(root, '.github/workflows');
const workflowFiles = existsSync(workflowDirectory)
  ? readdirSync(workflowDirectory)
      .filter((name) => /[.]ya?ml$/u.test(name))
      .map((name) => join(workflowDirectory, name))
  : [];
for (const workflowFile of workflowFiles) {
  const workflow = readFileSync(workflowFile, 'utf8');
  for (const match of workflow.matchAll(
    /^\s*(?:-\s*)?uses:\s*['"]?([^'"\s#]+)['"]?(?:\s+#.*)?$/gmu,
  )) {
    const target = match[1];
    if (target.startsWith('./')) continue;
    const parsed = /^([^@]+)@([0-9a-f]{40})$/u.exec(target);
    if (parsed === null) {
      violations.push(
        `${relative(root, workflowFile)} action is not pinned by a commit SHA: ${target}`,
      );
      continue;
    }
    const [, action, revision] = parsed;
    const existing = actions.get(action);
    if (existing !== undefined && existing !== revision) {
      violations.push(`${action} has conflicting CI revisions ${existing} and ${revision}`);
    }
    actions.set(action, revision);
    const registeredAction = new RegExp(
      `\\|\\s*\`${escapeRegularExpression(action)}\`\\s*\\|\\s*\`${revision}\``,
      'u',
    ).test(register);
    if (!registeredAction) {
      violations.push(`DEPENDENCIES.md is missing action pin ${action}@${revision}`);
    }
  }
}
if (actions.size === 0) violations.push('CI contains no registered external actions');

const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');
for (const setting of [
  'engineStrict: true',
  'resolutionMode: highest',
  'strictPeerDependencies: true',
  'saveExact: true',
  'cacheDir: .dev/cache/pnpm-cache',
  'stateDir: .dev/cache/pnpm-state',
  'storeDir: .dev/cache/pnpm-store',
  'minimumReleaseAge: 10080',
  'minimumReleaseAgeStrict: true',
  'trustPolicy: no-downgrade',
  'blockExoticSubdeps: true',
  "'nanoid@3.3.16': 3.3.17",
]) {
  if (!workspace.includes(setting)) violations.push(`pnpm-workspace.yaml is missing ${setting}`);
}
const allowBuildsSection = workspace.split('\nallowBuilds:\n')[1];
const allowedBuildEntries = (allowBuildsSection ?? '')
  .split(/\r?\n/u)
  .filter((line) => /^\s{2}[A-Za-z0-9@/_.-]+:\s*(?:true|false)\s*$/u.test(line));
if (allowedBuildEntries.length !== 1 || allowedBuildEntries[0]?.trim() !== 'esbuild: true') {
  violations.push('pnpm allowBuilds must contain only the reviewed esbuild: true entry');
}
if (workspace.includes('dangerouslyAllowAllBuilds')) {
  violations.push('dangerouslyAllowAllBuilds is prohibited');
}
if (existsSync('.npmrc')) {
  violations.push('.npmrc must not contain inert pnpm 11 non-registry settings');
}

const rootManifest = JSON.parse(readFileSync('package.json', 'utf8'));
if (rootManifest.packageManager !== 'pnpm@11.20.0') {
  violations.push('packageManager must be pnpm@11.20.0');
}
if (rootManifest.engines?.node !== '24.19.0' || rootManifest.engines?.pnpm !== '11.20.0') {
  violations.push('Node and pnpm engines must be exact Tier 0 pins');
}
if (readFileSync('.node-version', 'utf8').trim() !== '24.19.0') {
  violations.push('.node-version must pin 24.19.0 exactly');
}

if (violations.length > 0) {
  process.stderr.write(`${violations.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(
  `dependency:check PASS — ${externalDirectDependencies.size} external direct packages across ${packageFiles.length} manifests, ${images.size} images, ${actions.size} CI actions, and effective pnpm controls are registered exactly.\n`,
);
