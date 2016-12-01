'use strict'

const childProcess = require('child_process')
const minico = require('minico')
const ProtocolStream = require('./ProtocolStream')
const debug = require('debug')('worker-process:Worker')

const PROCESS_EXIT_TIMEOUT = 30000 // 30 seconds

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
  debug('constructing (%j, %j, %j)', file, _args, _options)
  let options
  if (Array.isArray(_args)) {
    options = this._options = parseOptions(file, _args, _options)
  } else {
    // "args" is options
    if (_options) {
      // They probably made a mistake
      throw new Error('args must be an array')
    }
    options = this._options = parseOptions(file, [], _args)
  }
  debug('set options: %j', options)

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
  this.child = null
  this.onmessage = null
  this._childAlive = false
  this._processTimeout = null
}

Worker.prototype.init = minico(function * init () {
  debug('init')
  // This is a one-time function
  delete this.init

  // Spawn the child
  const options = this._options
  debug('creating child')
  const child = this.child = childProcess.spawn(options.command, options.args, options.childProcess)

  // Handshake (and child handlers)
  let handshakeDone
  let handshakeResolve
  let handshakeReject
  const handshakePromise = new Promise((resolve, reject) => {
    handshakeResolve = resolve
    handshakeReject = reject
  })

  child.on('error', err => {
    debug('handshake@child:error %s', err)
    handshakeReject(err)
  })
  child.on('exit', (code, signal) => {
    debug('handshake@child:exit %j, %j', code, signal)
    handshakeReject(new Error(`Child exited before handshake completed: (code ${code}, signal ${signal})`))
  })

  const handleIPCError = err => {
    child.kill('SIGTERM')
    handshakeReject(err)
  }

  child.stdio[0].pipe(process.stdout)
  child.stdio[2].pipe(process.stderr)

  const ipc = child.stdio[3]

  ipc.on('close', () => {
    debug('handshake@ipc:close')
    handleIPCError(new Error('Unexpected "close" of IPC stream before handshake complete'))
  })
  ipc.on('error', err => {
    debug('handshake@ipc:error: %s', err)
    handleIPCError(err)
  })
  ipc.on('finish', () => {
    debug('handshake@ipc:finish')
    handleIPCError(new Error('Unexpected "finish" of IPC stream before handshake complete'))
  })
  ipc.on('end', () => {
    debug('handshake@ipc:end')
    handleIPCError(new Error('Unexpected "end" of IPC stream before handshake complete'))
  })

  const handleProtocolStreamError = err => {
    if (handshakeDone) {
      handleIPCError(err)
    } else {
      this._handleError(err)
    }
  }

  debug('creating protocol stream')
  this._protocolStream = new ProtocolStream(
    ipc, ipc, true,
    // onerror
    err => {
      debug('protocolstream onerror: %s', err)
      handleProtocolStreamError(err)
    },
    // onhandshake
    () => {
      debug('protocolstream onhandshake')
      handshakeResolve()
    },
    // onmessage
    message => {
      debug('protocolstream message')
      this._handleMessage(message)
    }
  )
  this._protocolStream.writableIPC.write(Buffer.from([0x00]))

  let handshakeTimeout
  if (options.handshakeTimeout) {
    handshakeTimeout = setTimeout(() => {
      handleIPCError(new Error('Handshake timed out'))
    }, options.handshakeTimeout)
  }
  yield handshakePromise
  handshakeDone = true
  if (handshakeTimeout) clearTimeout(handshakeTimeout)

  // We know for a fact that the child is alive.
  // So now, when we experience an error, we'll know
  // whether to send a kill signal or not.
  this._childAlive = true

  // Rewire the child handlers
  child.removeAllListeners('error')
  child.removeAllListeners('exit')

  ipc.removeAllListeners('close')
  ipc.removeAllListeners('error')
  ipc.removeAllListeners('finish')
  ipc.removeAllListeners('end')

  child.on('error', err => this._handleError(err))
  child.on('exit', (code, signal) => {
    this._childAlive = false
    if (code === 0) {
      this._handleExit()
      return
    }
    this._handleError(new Error(`Child exited with non-0 code (code ${code}, signal ${signal})`))
  })

  ipc.on('close', () => {
    this._handleError(new Error(`Unexpected "close" of IPC stream`))
  })
  ipc.on('error', err => {
    this._handleError(err)
  })
  ipc.on('finish', () => {
    this._handleError(new Error(`Unexpected "finish" of IPC stream`))
  })
  ipc.on('end', () => {
    this._handleError(new Error('Unexpected "end" of IPC stream'))
  })

  if (options.maxDuration) {
    this._processTimeout = setTimeout(() => {
      this._handleError(new Error(`Worker timed out`))
    }, options.maxDuration)
  }

  this._alive = true
})

Worker.prototype.send = function send (message) {
  if (!this._alive) {
    throw new Error('Cannot send message to non-alive worker')
  }
  return this._protocolStream.send(message)
}

Worker.prototype.kill = function kill (signal) {
  if (!this._childAlive) return
  this.child.kill(signal)
}

Worker.prototype._handleMessage = function _handleMessage (message) {
  if (!this._alive) return
  if (this.onmessage) this.onmessage(message)
}

Worker.prototype._handleError = function _handleError (err) {
  const cleanup = err => {
    this._lifetimeReject(err)
  }

  if (!this._alive) return
  this._alive = false
  if (this._childAlive) {
    this._childAlive = false
    this.kill('SIGTERM')
    const killTimeout = setTimeout(() => {
      cleanup(new Error('Child uncleanly exited, and did not terminate in time'))
    }, PROCESS_EXIT_TIMEOUT)
    this.child.on('exit', () => {
      clearTimeout(killTimeout)
      cleanup(err)
    })
  } else {
    cleanup(err)
  }
}

Worker.prototype._handleExit = function _handleExit () {
  this._alive = false
  this._lifetimeResolve()
}

module.exports = Worker
