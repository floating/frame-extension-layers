const path = require('path')
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin")

module.exports = [
  {
    mode: 'development',
    entry: './src/verification/index.js',
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: ['babel-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['*', '.js', '.jsx']
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'verification.js'
    },
    performance: {
      hints: false
    },
    plugins: [
      new NodePolyfillPlugin()
    ],
    watch: true
  }
]