'use strict'

const fs = require('fs')
const minico = require('minico')
const exit = require('exit')
const ProtocolStream = require('./ProtocolStream')
const debug = require('debug')('worker-process:Connection')

function Connection () {
  // Whether the connection is available for sending messages to
  this._connected = false

  this.onmessage = null
}

// "Establishes" the connection by making sure that fd 3 is
// a socket and completing the handshake
Connection.prototype.init = minico(function * init () {
  // This is a one-time function
  delete this.init

  if (!fs.fstatSync(3).isSocket()) {
    throw new Error(
      'Could not establish connection with fd 3 (not a socket),' +
      ' is this process a worker-process child process?'
    )
  }

  const readable = fs.createReadStream(null, {fd: 3})
  const writable = fs.createWriteStream(null, {fd: 3})

  const handleHandshakeError = err => {
    handshakeReject(err)
  }

  readable.on('error', handleHandshakeError)
  readable.on('close', () => {
    handleHandshakeError(
      new Error('Unexpected "close" of readable IPC stream before handshake complete')
    )
  })
  readable.on('end', () => {
    handleHandshakeError(
      new Error('Unexpected "end" of readable IPC stream before handshake complete')
    )
  })

  writable.on('error', handleHandshakeError)
  writable.on('close', () => {
    handleHandshakeError(
      new Error('Unexpected "close" of writable IPC stream before handshake complete')
    )
  })
  writable.on('finish', () => {
    handleHandshakeError(
      new Error('Unexpected "finish" of writable IPC stream before handshake complete')
    )
  })

  let handshakeResolve
  let handshakeReject
  let handshakePromise = new Promise((resolve, reject) => {
    handshakeResolve = resolve
    handshakeReject = reject
  })

  let handshakeComplete = false
  const handleError = err => {
    if (!handshakeComplete) {
      handleHandshakeError(err)
    } else {
      this._handleError(err)
    }
  }

  this._protocolStream = new ProtocolStream(
    readable, writable, false,
    // onerror
    handleError,
    // onhandshake
    () => {
      this._protocolStream.writableIPC.write(Buffer.from([0x01]))
      handshakeResolve()
    },
    // onmessage
    message => this._handleMessage(message)
  )

  try {
    yield handshakePromise
  } catch (err) {
    this._handleError(err)
  }

  // Rewire the event handlers.
  { // eslint-disable-line no-lone-blocks
    readable.removeAllListeners('error')
    readable.removeAllListeners('close')
    readable.removeAllListeners('end')

    readable.on('error', err => this._handleError(err))
    readable.on('close', () => {
      this._handleError(
        new Error('Unexpected "close" of readable IPC stream')
      )
    })
    readable.on('end', () => {
      this._handleError(
        new Error('Unexpected "end" of readable IPC stream')
      )
    })

    writable.removeAllListeners('error')
    writable.removeAllListeners('close')
    writable.removeAllListeners('finish')
    writable.on('error', err => this._handleError(err))
    writable.on('close', () => {
      this._handleError(
        new Error('Unexpected "close" of writable IPC stream')
      )
    })
    writable.on('finish', () => {
      this._handleError(
        new Error('Unexpected "finish" of writable IPC stream')
      )
    })
  }

  this._connected = true
})

// Logs the error, and kills the process.
Connection.prototype._handleError = function _handleError (err) {
  console.error(err)
  exit(1)
}

// Forwards the message to the onmessage handler
Connection.prototype._handleMessage = function _handleMessage (message) {
  if (this.onmessage) this.onmessage(message)
}

// _protocolStream returns a Promise, so this technically
// returns a Promise
Connection.prototype.send = function send (message) {
  if (!this._connected) {
    throw new Error('Cannot send when not connected')
  }
  return this._protocolStream.send(message)
}

// Wait for the message backlog to drain, and then close the connection
Connection.prototype.finish = function finish () {
}

module.exports = Connection
