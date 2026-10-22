const Encore = require('@symfony/webpack-encore');
const fs = require('fs');
const path = require('path');
const getIbexaConfig = require('./ibexa.webpack.config.js');
const ibexaConfig = getIbexaConfig(Encore);
const customConfigs = require('./ibexa.webpack.custom.configs.js');

/**
 * Exponential Platform installs se7enxweb/admin-ui and se7enxweb/admin-ui-assets
 * in place of ibexa/admin-ui and ibexa/admin-ui-assets. Bundle configs
 * (ibexa/fieldtype-richtext, and admin-ui-assets releases made before the
 * rename) alias them to ./vendor/ibexa/..., which does not exist then; point
 * those aliases at the installed forks.
 */
const forkAliases = {
    '@ibexa-admin-ui': 'admin-ui',
    '@ibexa-admin-ui-assets': 'admin-ui-assets',
};

Object.entries(forkAliases).forEach(([alias, name]) => {
    const forkPath = path.resolve(__dirname, 'vendor/se7enxweb', name);

    if (fs.existsSync(path.resolve(__dirname, 'vendor/ibexa', name)) || !fs.existsSync(forkPath)) {
        return;
    }

    [ibexaConfig, ...customConfigs].forEach((config) => {
        if (config && config.resolve && config.resolve.alias) {
            config.resolve.alias[alias] = forkPath;
        }
    });
});

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
