import babelPlugin from '@rollup/plugin-babel';
import commonjsPlugin from '@rollup/plugin-commonjs';
import jsonPlugin from '@rollup/plugin-json';
import resolvePlugin from '@rollup/plugin-node-resolve';
import replacePlugin from '@rollup/plugin-replace';
import { isAbsolute, relative, resolve } from 'path';
import { readPackageUp } from 'read-package-up';
import { defineConfig } from 'rollup';
import postcssPlugin from 'rollup-plugin-postcss';
import userscript from 'rollup-plugin-userscript';

const { packageJson } = /** @type {import('read-package-up').NormalizedReadResult} */ (await readPackageUp());
const extensions = ['.ts', '.tsx', '.mjs', '.js', '.jsx'];
const externalModuleMapping = {
  // TODO(netux): we are not really using these
  // 'https://cdn.jsdelivr.net/npm/@violentmonkey/ui@0.7': [
  //   {
  //     provides: '@violentmonkey/ui',
  //     as: 'VM'
  //   }
  // ],
  // 'https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2': [
  //   {
  //     provides: '@violentmonkey/dom',
  //     as: 'VM'
  //   }
  // ],
  'https://cdn.jsdelivr.net/npm/@violentmonkey/dom@2/dist/solid.min.js': [
    {
      provides: 'solid-js',
      as: 'VM.solid'
    },
    {
      provides: 'solid-js/web',
      as: 'VM.solid.web'
    },
    {
      provides: 'solid-js/store',
      as: 'VM.solid.store'
    }
  ],
  'https://cdn.jsdelivr.net/npm/three-js@79.0.0/three.min.js': [ // TODO(netux): migrate to a newer version of three.js
    {
      provides: 'three',
      as: 'THREE'
    }
  ],
  'https://cdn.jsdelivr.net/npm/internet-roadtrip-framework': [
    {
      provides: 'internet-roadtrip-framework',
      as: 'IRF'
    }
  ]
};

const externalModules = Object.values(externalModuleMapping)
  .flatMap((mapping) => mapping.map(({ provides }) => provides));
const userScriptRequireUrls = Object.keys(externalModuleMapping)
const iifeGlobalsMapping = Object.fromEntries(
  Object.values(externalModuleMapping)
    .flat()
    .map(({ provides, as }) => [provides, as])
);

export default defineConfig(
  /** @type {import('rollup').RollupOptions} */ (Object.entries({
    'look-out-the-window': 'src/userscript/index.tsx',
  }).map(([name, entry]) => ({
    input: entry,
    plugins: [
      postcssPlugin({
        inject: false,
        minimize: true,
      }),
      babelPlugin({
        // import helpers from '@babel/runtime'
        babelHelpers: 'runtime',
        plugins: [
          [
            import.meta.resolve('@babel/plugin-transform-runtime'),
            {
              useESModules: true,
              version: '^7.5.0', // see https://github.com/babel/babel/issues/10261#issuecomment-514687857
            },
          ],
        ],
        exclude: 'node_modules/**',
        extensions,
      }),
      replacePlugin({
        values: {
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        },
        preventAssignment: true,
      }),
      resolvePlugin({ browser: false, extensions }),
      commonjsPlugin(),
      jsonPlugin(),
      userscript((meta) => {
        meta = meta.replace('PACKAGE_JSON_VERSION', packageJson.version);

        const metaLines = meta.split('\n');

        let metaEndLineIdx = metaLines.indexOf('// ==/UserScript==');
        if (metaEndLineIdx < 0) {
          metaEndLineIdx = metaLines.length - 1;
        }

        const addedLines = [
          `// @author ${[
            packageJson.author?.name,
            ... (
              packageJson.contributors?.map((contributor) =>
                typeof contributor === 'string'
                  ? contributor
                  : contributor.name
              ) ?? []
            )
          ].filter((authorName) => !!authorName).join(', ')}`,
          ... userScriptRequireUrls.map((url) => `// @require ${url}`)
        ];

        metaLines.splice(metaEndLineIdx, /* deleteCount: */ 0, ... addedLines)

        return metaLines.join('\n');
      }),
    ],
    external: defineExternal(externalModules),
    output: {
      format: 'iife',
      file: `dist/${name}.user.js`,
      globals: iifeGlobalsMapping,
      indent: false,
    },
  }))),
);

function defineExternal(externals) {
  return (id) =>
    externals.some((pattern) => {
      if (typeof pattern === 'function') return pattern(id);
      if (pattern && typeof pattern.test === 'function')
        return pattern.test(id);
      if (isAbsolute(pattern))
        return !relative(pattern, resolve(id)).startsWith('..');
      return id === pattern || id.startsWith(pattern + '/');
    });
}
