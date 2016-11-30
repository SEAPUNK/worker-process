'use strict'

const minico = require('minico')

// Helper function to determine property existence for properties
// that treat null as undefined
function exists (prop) {
  return (prop !== null && prop !== undefined)
}

// This function creates a new object every time, so we don't have to worry
// about cloning it.
function getDefaults () {
  return {
    // Worker-specific options
    isCommand: false,
    maxDuration: 60000,
    handshakeTimeout: 60000,

    // child_process.spawn-specific args and options
    command: process.argv[0],
    args: [],
    childProcess: {
      stdio: ['pipe', 'pipe', 'pipe', 'pipe']
    }
  }
}

function parseOptions (file, args, _options) {
  if (typeof file !== 'string') {
    throw new Error('file must be a string')
  }

  const targetOptions = getDefaults()

  // Copy the source option object, since we'll be mutating the
  // top-level properties (deleting them).
  const sourceOptions = Object.assign({}, _options)

  // If there are no options, then we just skip ahead to setting the arg.
  if (!_options) {
    targetOptions.args.push(file)
    for (let arg of args) {
      targetOptions.args.push(arg)
    }
    return targetOptions
  }

  // isCommand
  if (exists(sourceOptions.isCommand)) {
    targetOptions.isCommand = sourceOptions.isCommand
  }

  // maxDuration
  if (exists(sourceOptions.maxDuration)) {
    const maxDuration = sourceOptions.maxDuration
    if (typeof maxDuration !== 'number') {
      throw new Error('options.maxDuration must be a number')
    }
    if (maxDuration < 0) {
      throw new Error('options.maxDuration must not be a number below 0')
    }
    targetOptions.maxDuration = maxDuration
  }

  // handshakeTimeout
  if (exists(sourceOptions.handshakeTimeout)) {
    const handshakeTimeout = sourceOptions.handshakeTimeout
    if (typeof handshakeTimeout !== 'number') {
      throw new Error('options.handshakeTimeout must be a number')
    }
    if (handshakeTimeout < 0) {
      throw new Error('options.handshakeTimeout must not be a number below 0')
    }
    targetOptions.handshakeTimeout = handshakeTimeout
  }

  // command
  if (targetOptions.isCommand) {
    sourceOptions.command = file
  }

  // args
  if (!targetOptions.isCommand) {
    targetOptions.args.push(file)
  }
  for (let arg of args) {
    targetOptions.args.push(arg)
  }

  // childProcess.stdio
  if (exists(sourceOptions.stdio)) {
    if (!Array.isArray(sourceOptions.stdio)) {
      throw new Error('options.stdio must be an array or undefined or null')
    }
    for (let i = 0; i < sourceOptions.stdio; i++) {
      if (i === 3 && sourceOptions.stdio[i]) {
        throw new Error('options.stdio[3] must be falsy')
      }
      targetOptions.childProcess.stdio[i] = sourceOptions.stdio[i]
    }
  }

  // remaining childProcess options
  delete sourceOptions.isCommand
  delete sourceOptions.maxDuration
  delete sourceOptions.handshakeTimeout
  delete sourceOptions.stdio
  for (let prop of Object.keys(sourceOptions)) {
    targetOptions.childProcess[prop] = sourceOptions[prop]
  }

  return targetOptions
}

// Worker.construtor(command, [args], {
//  - child_process.spawn options, with the exception of:
//  - isCommand (Boolean, default false) if file is not a file to be run with node.js
//  - maxDuration (Number, default 60000) the maximum amount of time the worker
//                                        process is allowed to run
//  - handshakeTimeout (Number, default 60000) how long in ms to wait for the handshake
//                                            complete before failing the worker process
//  - stdio -> child_process.stdio, with 4th entry in array managed by us
// })
function Worker (file, _args, _options) {
  let options
  if (Array.isArray(_args)) {
    this._options = parseOptions(file, _args, _options)
  } else if (_args) {
    // "args" is options
    if (_options) {
      // They probably made a mistake
      throw new Error('args must be an array')
    }
    options = this._options = parseOptions(file, [], _args)
  }

  // If we're executing a file, we must have at least one argument to pass to
  // node. Not guaranteed to be a script file, but at least we're part of the
  // way there.
  if (!options.isCommand && !options.args.length) {
    throw new Error('No file specified')
  }

  // Promise (resolve = exit 0, reject = error || exit != 0)
  this.lifetime = new Promise((resolve, reject) => {
    this._lifetimeResolve = resolve
    this._lifetimeReject = reject
  })

  // all the non-instance-method properties that this instance has and uses
  this._alive = false
  this._protocolStream = null
  this.childProcess = null
  this.onmessage = null
}

Worker.prototype.init = minico(function init () {
  // This is a one-time function
  delete this.init

  // TODO
  // set this.childProcess
  // set this._alive
  // set this._protocolStream
})

Worker.prototype.send = function send (message) {
  if (!this._alive) {
    throw new Error('Cannot send message to non-alive worker')
  }
  return this._protocolStream.send(message)
}

Worker.prototype.kill = function kill (signal) {
  this.childProcess.kill(signal)
}

module.exports = Worker
