'use strict'

const minico = require('minico')

// TODO:
// Worker

// Worker.construtor(command, [args], {
//  - child_process.spawn options, with the exception of:
//  - isCommand (Boolean, default false) if file is not a file to be run with node.js
//  - maxDuration (Number, default 60000) the maximum amount of time the worker
//                                        process is allowed to run
//  - handshakeTimeout (Number, default 60000) how long in ms to wait for the handshake
//                                            complete before failing the worker process
//  - stdio (?) -> child_process.stdio, with 4th entry in array managed by us
//  - detached (?) -> child_process.detached (do we allow this?)
// })
// Worker.send()
// Worker.init(), a one-time initialization process that actually starts the worker
// Worker.kill(), passthrough to Worker.childProcess.kill()
// Worker.onmessage = fn

// Worker.lifetime = Promise (resolve = exit 0, reject = error || exit != 0)

// Worker.childProcess = ChildProcess instance

const WORKER_DEFAULTS = {
  command: process.argv[0],
  args: [],

  isCommand: false,
  maxDuration: 60000,
  handshakeTimeout: 60000,
  childProcess: {
    stdio: ['pipe', 'pipe', 'pipe']
  }
}

function parseOptions (file, _options) {
  if (typeof file !== 'string') {
    throw new Error('"file" must be a string')
  }

  // Copy the object, since we'll be mutating it.
  const options = Object.assign({}, _options)
  if (!options) return WORKER_DEFAULTS
}

function Worker (file, args, options) {
  if (Array.isArray(args)) {
    this._options = parseOptions(file, args, options)
  } else if (args) {
    // "args" is options
    this._options = parseOptions(file, [], args)
  }

  this.lifetime = new Promise((resolve, reject) => {
    this._lifetimeResolve = resolve
    this._lifetimeReject = reject
  })
}

module.exports = Worker
