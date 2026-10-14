'use strict';

// Webpack configuration for the single-file (standalone HTML) build.
//
// It is deliberately separate from config/webpack.config.js (the regular
// create-react-app build): everything has to end up in ONE document, so
//   * binary assets (WebAssembly, the MPQ file list, icons) become data: URIs
//     through singlefile/inline-asset-loader.js,
//   * web workers are compiled by a first pass and inlined as source strings
//     through singlefile/worker-inline-loader.js,
//   * CSS is extracted and pasted into a <style> tag by the build script,
//   * anything that needs the network at build/deploy time (analytics,
//     source-map remapping, the service worker) is stubbed out or dropped.
//
// Both passes are driven by scripts/build-single-html.js.

const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const safePostCssParser = require('postcss-safe-parser');
const postcssNormalize = require('postcss-normalize');

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');
const singleDir = path.join(rootDir, 'singlefile');
const pkg = require(path.join(rootDir, 'package.json'));

// Where the shareware spawn.mpq is fetched from at runtime (the app itself
// contains no game data). Defaults to the official hosted build.
const DEFAULT_PUBLIC_URL = pkg.homepage || 'https://d07riv.github.io/diabloweb';

// Browsers that support async/await + WebAssembly natively. Everything newer
// than this stays as-is, everything newer still (class fields, optional
// chaining, ...) is transpiled - the bundler's minifier cannot parse those.
const BABEL_TARGETS = {chrome: '64', firefox: '60', safari: '12', edge: '79'};

const ASSET_RE = /\.(wasm|txt|svg|png|jpe?g|gif|ico|webp|bmp|woff2?|ttf|eot|otf|mpq|mp3|wav|ogg)$/i;

function defineEnvironment(publicUrl) {
  const raw = {
    NODE_ENV: 'production',
    PUBLIC_URL: publicUrl,
    VERSION: pkg.version,
  };
  const stringified = {};
  for (const key of Object.keys(raw)) {
    stringified[key] = JSON.stringify(raw[key]);
  }
  return new webpack.DefinePlugin({'process.env': stringified});
}

function babelOptions(jsx) {
  const presets = [[require.resolve('@babel/preset-env'), {targets: BABEL_TARGETS, modules: false}]];
  if (jsx) {
    presets.push([require.resolve('@babel/preset-react'), {development: false}]);
  }
  return {
    babelrc: false,
    configFile: false,
    compact: true,
    cacheDirectory: false,
    presets,
  };
}

function jsRules({inlineWorkers, workerDir}) {
  const rules = [{parser: {requireEnsure: false}}];

  if (inlineWorkers) {
    // Second pass: workers are already compiled, inline their source.
    rules.push({
      test: /\.worker\.js$/,
      include: srcDir,
      use: [{loader: path.join(singleDir, 'worker-inline-loader.js'), options: {workerDir}}],
    });
  }

  rules.push({
    test: /\.(js|jsx|mjs)$/,
    include: [srcDir, singleDir],
    ...(inlineWorkers ? {exclude: /\.worker\.js$/} : {}),
    loader: require.resolve('babel-loader'),
    options: babelOptions(true),
  });

  // Dependencies are transpiled too, so that the minifier (terser 3) only ever
  // sees syntax it understands.
  rules.push({
    test: /\.(js|mjs)$/,
    include: /node_modules/,
    exclude: /@babel(?:\/|\\{1,2})runtime/,
    loader: require.resolve('babel-loader'),
    options: babelOptions(false),
  });

  return rules;
}

function postcssOptions() {
  return {
    ident: 'postcss',
    sourceMap: false,
    plugins: () => [
      require('postcss-flexbugs-fixes'),
      require('postcss-preset-env')({
        autoprefixer: {flexbox: 'no-2009'},
        stage: 3,
      }),
      postcssNormalize(),
    ],
  };
}

function styleRules() {
  const extract = {loader: MiniCssExtractPlugin.loader};
  const css = importLoaders => ({
    loader: require.resolve('css-loader'),
    options: {importLoaders, sourceMap: false},
  });
  const postcss = {loader: require.resolve('postcss-loader'), options: postcssOptions()};
  const sass = {
    loader: require.resolve('sass-loader'),
    options: {
      implementation: require('sass'),
      sourceMap: false,
      // dart-sass warns about the legacy API that sass-loader 7 still uses
      silenceDeprecations: ['legacy-js-api'],
      quietDeps: true,
    },
  };
  return [
    {test: /\.css$/, use: [extract, css(1), postcss]},
    {test: /\.(scss|sass)$/, use: [extract, css(2), postcss, sass]},
  ];
}

const terserOptions = {
  parse: {ecma: 8},
  compress: {ecma: 5, warnings: false, comparisons: false, inline: 2},
  mangle: {safari10: true},
  output: {ecma: 5, comments: false, ascii_only: true},
};

function aliases(embeddedAssets) {
  return {
    // No analytics, no source-map remapping and no network for bundled assets.
    'react-ga$': path.join(singleDir, 'stubs/react-ga.js'),
    'sourcemapped-stacktrace$': path.join(singleDir, 'stubs/sourcemapped-stacktrace.js'),
    'axios$': path.join(singleDir, 'axios-shim.js'),
    'embedded-assets$': embeddedAssets,
  };
}

function baseConfig({publicUrl, alias}) {
  return {
    mode: 'production',
    bail: true,
    devtool: false,
    context: rootDir,
    output: {
      publicPath: '',
      pathinfo: false,
      // webpack 4 hashes with md4, which OpenSSL 3 refuses; the build script
      // re-execs node with --openssl-legacy-provider.
      hashFunction: 'sha256',
    },
    resolve: {
      modules: ['node_modules'],
      extensions: ['.web.js', '.mjs', '.js', '.json', '.web.jsx', '.jsx', '.jscc'],
      alias,
    },
    // Same node shims create-react-app uses: the Emscripten glue references
    // require('fs')/require('path')/__dirname inside dead Node.js branches.
    node: {
      module: 'empty',
      dgram: 'empty',
      dns: 'mock',
      fs: 'empty',
      http2: 'empty',
      net: 'empty',
      tls: 'empty',
      child_process: 'empty',
    },
    performance: false,
    stats: 'minimal',
    plugins: [defineEnvironment(publicUrl)],
  };
}

// Pass 1: compile the two web workers into self-contained scripts.
function workerConfig({workerDir, publicUrl, embeddedAssets}) {
  const config = baseConfig({
    publicUrl,
    alias: aliases(embeddedAssets),
  });
  Object.assign(config, {
    name: 'workers',
    target: 'webworker',
    entry: {
      'game.worker.js': path.join(srcDir, 'api/game.worker.js'),
      'mpqcmp.worker.js': path.join(srcDir, 'mpqcmp/mpqcmp.worker.js'),
    },
    module: {
      strictExportPresence: true,
      defaultRules: [{type: 'javascript/auto', resolve: {}}, {test: /\.json$/i, type: 'json'}],
      rules: jsRules({inlineWorkers: false}).concat([{test: ASSET_RE, loader: path.join(singleDir, 'inline-asset-loader.js')}]),
    },
    optimization: {
      minimize: true,
      minimizer: [new TerserPlugin({terserOptions, sourceMap: false, cache: false, parallel: false})],
      splitChunks: false,
      runtimeChunk: false,
      concatenateModules: false,
    },
  });
  config.output.path = workerDir;
  config.output.filename = '[name]';
  config.output.globalObject = 'self';
  return config;
}

// Pass 2: compile the app itself, with the workers inlined.
function appConfig({appDir, workerDir, publicUrl, embeddedAssets}) {
  const config = baseConfig({
    publicUrl,
    alias: aliases(embeddedAssets),
  });
  Object.assign(config, {
    name: 'app',
    target: 'web',
    entry: {main: path.join(singleDir, 'entry.js')},
    module: {
      strictExportPresence: true,
      defaultRules: [{type: 'javascript/auto', resolve: {}}, {test: /\.json$/i, type: 'json'}],
      rules: jsRules({inlineWorkers: true, workerDir})
        .concat(styleRules())
        .concat([{test: ASSET_RE, loader: path.join(singleDir, 'inline-asset-loader.js')}]),
    },
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({terserOptions, sourceMap: false, cache: false, parallel: false}),
        new OptimizeCSSAssetsPlugin({cssProcessorOptions: {parser: safePostCssParser, map: false}}),
      ],
      splitChunks: false,
      runtimeChunk: false,
      concatenateModules: false,
    },
  });
  config.output.path = appDir;
  config.output.filename = 'main.js';
  config.output.globalObject = 'this';
  config.plugins.push(new MiniCssExtractPlugin({filename: 'main.css'}));
  return config;
}

module.exports = {
  DEFAULT_PUBLIC_URL,
  workerConfig,
  appConfig,
};
