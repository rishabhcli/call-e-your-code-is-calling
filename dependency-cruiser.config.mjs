import { resolve } from 'node:path';

const repositoryRoot = import.meta.dirname;
// Dependency-cruiser matches npm edges against their import specifier (for
// example `zod`) or a resolved package path, depending on the rule phase.
// Match package path segments without the overlapping optional pnpm path that
// dependency-cruiser's safe-regex validation correctly rejects.
const forbiddenDomainPackagePath =
  '(^|/)(next|react|react-dom|pg|@call-e/calle|@opentelemetry)(/|$)';
const allowedDomainPackagePath = '(^|/)zod(/|$)';

/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'domain-does-not-import-applications',
      severity: 'error',
      from: { path: '^packages/' },
      to: { path: '^(apps|tests|scripts)/' },
    },
    {
      name: 'domain-does-not-import-frameworks-or-transport-sdks',
      severity: 'error',
      from: { path: '^packages/(import|freshness|call-plan|evidence|review-publish)/' },
      to: {
        path: forbiddenDomainPackagePath,
      },
    },
    {
      name: 'domain-external-dependencies-are-allowlisted',
      severity: 'error',
      from: { path: '^packages/(import|freshness|call-plan|evidence|review-publish)/' },
      to: {
        dependencyTypes: ['npm'],
        pathNot: allowedDomainPackagePath,
      },
    },
    {
      name: 'domain-does-not-import-node-runtime-capabilities',
      severity: 'error',
      from: { path: '^packages/(import|freshness|call-plan|evidence|review-publish)/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'calle-sdk-is-contained-in-calle-adapter',
      severity: 'error',
      from: { pathNot: '^packages/calle/src/adapter/' },
      to: {
        path: '(^|/)@call-e/calle(/|$)',
      },
    },
    {
      name: 'review-publish-does-not-depend-on-calling',
      severity: 'error',
      from: { path: '^packages/review-publish/' },
      to: { path: '^packages/(call-plan|calle)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: ['(^|/)dist/', '(^|/)coverage/', '(^|/)[.]next/'],
    tsConfig: { fileName: resolve(repositoryRoot, 'tsconfig.base.json') },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['types', 'import', 'default'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};

export default config;
