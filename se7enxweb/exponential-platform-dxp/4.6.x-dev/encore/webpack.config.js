const fs = require('fs');
const path = require('path');
const Encore = require('@symfony/webpack-encore');
const getWebpackConfigs = require('@ibexa/frontend-config/webpack-config/get-configs');
const customConfigsPaths = require('./var/encore/ibexa.webpack.custom.config.js');

/**
 * After getWebpackConfigs runs the richtext encore config, the richtext webpack
 * config has sass-loader entries that use `@import './public/bundles/...'` paths
 * relative to the project root. Dart Sass 1.x (modern API) does not resolve
 * `./`-prefixed paths through includePaths — it resolves them strictly relative
 * to the importing file inside vendor/, where they don't exist.
 *
 * We patch every sass-loader entry in every custom config to force the legacy
 * Dart Sass API with includePaths set to the project root, restoring the
 * behaviour that worked with older node-sass.
 */
function patchSassLoaderForLegacyImports(configs) {
    const projectRoot = __dirname;

    function patchLoaderList(useArray) {
        if (!Array.isArray(useArray)) return;
        useArray.forEach((loaderEntry) => {
            if (!loaderEntry || typeof loaderEntry !== 'object') return;
            const loaderName = loaderEntry.loader || '';
            if (!loaderName.includes('sass-loader')) return;
            loaderEntry.options = loaderEntry.options || {};
            loaderEntry.options.api = 'legacy';
            loaderEntry.options.sassOptions = Object.assign(
                {},
                loaderEntry.options.sassOptions || {},
                { includePaths: [projectRoot] }
            );
        });
    }

    function patchRule(rule) {
        if (!rule) return;
        // Direct use array
        patchLoaderList(rule.use);
        // oneOf sub-rules
        if (Array.isArray(rule.oneOf)) {
            rule.oneOf.forEach(patchRule);
        }
    }

    configs.forEach((config) => {
        if (!config || !config.module || !Array.isArray(config.module.rules)) return;
        config.module.rules.forEach(patchRule);
    });
    return configs;
}

const customConfigs = patchSassLoaderForLegacyImports(
    getWebpackConfigs(Encore, customConfigsPaths)
);

/**
 * ibexa/fieldtype-richtext's encore config sets the webpack alias:
 *   '@ibexa-admin-ui' -> './vendor/ibexa/admin-ui'
 * but this project uses se7enxweb/admin-ui which replaces ibexa/admin-ui.
 * Override the alias on every custom config so richtext JS sources resolve.
 */
customConfigs.forEach((config) => {
    if (config && config.resolve && config.resolve.alias) {
        config.resolve.alias['@ibexa-admin-ui'] = path.resolve(__dirname, 'vendor/se7enxweb/admin-ui');
    }
});

const isReactBlockPathCreated = fs.existsSync('./assets/page-builder/react/blocks');

Encore.reset();
Encore
    .setOutputPath('public/build/')
    .setPublicPath('/build')
    .enableSassLoader()
    .enableStimulusBridge('./assets/controllers.json')
    .enableReactPreset((options) => {
        options.runtime = 'classic';
    })
    .enableSingleRuntimeChunk()
    .copyFiles({
        from: './assets/images',
        to: 'images/[path][name].[ext]',
        pattern: /\.(png|svg)$/,
    })
    .configureBabelPresetEnv((config) => {
        config.useBuiltIns = 'usage';
        config.corejs = 3;
    });

// Welcome page stylesheets
Encore.addEntry('welcome-page-css', [
    path.resolve(__dirname, './assets/scss/welcome-page.scss'),
]);

// Welcome page javascripts
Encore.addEntry('welcome-page-js', [
    path.resolve(__dirname, './assets/js/welcome.page.js'),
]);

if (isReactBlockPathCreated) {
    // React Blocks javascript
    Encore.addEntry('react-blocks-js', './assets/js/react.blocks.js');
}

Encore.addEntry('app', './assets/app.js');

const projectConfig = Encore.getWebpackConfig();

projectConfig.name = 'app';

module.exports = [...customConfigs, projectConfig];
