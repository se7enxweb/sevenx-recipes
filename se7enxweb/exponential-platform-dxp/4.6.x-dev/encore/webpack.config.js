const Encore = require('@symfony/webpack-encore');
const fs = require('fs');
const path = require('path');
const getIbexaConfig = require('./ibexa.webpack.config.js');
const ibexaConfig = getIbexaConfig(Encore);
const customConfigs = require('./ibexa.webpack.custom.configs.js');

/**
 * Exponential Platform installs se7enxweb/admin-ui in place of ibexa/admin-ui.
 * Bundle configs (ibexa/fieldtype-richtext) alias '@ibexa-admin-ui' to
 * ./vendor/ibexa/admin-ui, which does not exist then; point it at the fork.
 */
const adminUiPath = path.resolve(__dirname, 'vendor/se7enxweb/admin-ui');

if (!fs.existsSync(path.resolve(__dirname, 'vendor/ibexa/admin-ui')) && fs.existsSync(adminUiPath)) {
    [ibexaConfig, ...customConfigs].forEach((config) => {
        if (config && config.resolve && config.resolve.alias) {
            config.resolve.alias['@ibexa-admin-ui'] = adminUiPath;
        }
    });
}

Encore.reset();
Encore.setOutputPath('public/build/')
    .setPublicPath('/build')
    .enableStimulusBridge('./assets/controllers.json')
    .enableSassLoader()
    .enableReactPreset()
    .enableSingleRuntimeChunk()
    .copyFiles({
        from: './assets/images',
        to: 'images/[path][name].[ext]',
        pattern: /\.(png|svg)$/,
    })

    // enables @babel/preset-env polyfills
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

Encore.addEntry('app', './assets/app.js');

const projectConfig = Encore.getWebpackConfig();

projectConfig.name = 'app';

module.exports = [ibexaConfig, ...customConfigs, projectConfig];
