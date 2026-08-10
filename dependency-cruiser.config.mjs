import { resolve } from 'node:path';

const repositoryRoot = import.meta.dirname;
const externalPackagePath = '(?:^|/)node_modules/(?:[.]pnpm/[^/]+/node_modules/)?';
const forbiddenDomainPackagePath = `${externalPackagePath}(?:next|react|react-dom|pg|@call-e/calle|@opentelemetry/)(?:/|$)`;
const allowedDomainPackagePath = `${externalPackagePath}zod(?:/|$)`;

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
        dependencyTypes: ['npm'],
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
        dependencyTypes: ['npm'],
        path: `${externalPackagePath}@call-e/calle(?:/|$)`,
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
