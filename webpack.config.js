const path = require('path');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    target: 'node',
    mode: 'production', // 使用生产模式进行优化
    entry: './extension.js',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'extension.js',
        libraryTarget: "commonjs2",
        devtoolModuleFilenameTemplate: "../[resource-path]",
    },
    externals: {
        vscode: "commonjs vscode"
    },
    resolve: {
        extensions: ['.js']
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            }
        ]
    },
    optimization: {
        minimizer: [new TerserPlugin({
            terserOptions: {
                keep_classnames: true,
                keep_fnames: true
            }
        })],
    },
    plugins: [
        // 如果需要复制其他资源文件，可以使用 CopyWebpackPlugin
        // new CopyWebpackPlugin({
        //   patterns: [
        //     { from: 'chat', to: 'chat' },
        //     { from: 'job', to: 'job' },
        //     { from: 'media', to: 'media' },
        //   ],
        // }),
    ]
};