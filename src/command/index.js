const yargs = require('yargs')
// const { usingRefreshToken, validateScope, makeRefreshTokenWithWebFlow } = require('./auth')
const auth = require('./auth')
const run = require('./run')

module.exports = main

function main () {
  yargs // eslint-disable-line
    .command(run) // default command - validates configuration
    .command(auth)
    .options({
      verbose: {
        // should be a count?? -v -v -vvv
        alias: 'v',
        describe: 'Run with verbose logging',
        default: false
      },
      progress: {
        alias: 'p',
        describe: 'Run with progress bar',
        default: true,
        type: 'boolean'
      },
      headless: {
        alias: 'h',
        describe: 'Run in headless mode',
        default: true,
        type: 'boolean'
      },
      basepath: {
        alias: 'b',
        describe: 'Provide a base path for user-data-dir and downloads directories',
        default: './data',
        type: 'string'
      }
    })
    .demandCommand(1, 'You need at least one command before moving on')
    .epilogue(' * You should NOT check in your credentials/data directory into version control!! *')
    .help()
    .argv
}

main()
