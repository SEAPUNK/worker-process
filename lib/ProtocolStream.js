'use strict'

// This is a class that wraps around a duplex stream, taking over the reading
// and writing of data that's done within the stream.
//
// Implements the protocol, doing everything in a streaming fashion to minimize
// memory usage and maximize performance.

const stream = require('stream')
const buffer = require('buffer')

// Max buffer value, minus the 4 bytes needed for payload length
//
// For future-proofness, if kMaxLength is increased to be above
// max uint32 number byte length, then use the max uint32 number length
const MAX_LENGTH = Math.min(buffer.kMaxLength - 4, 4294967295)
const TOO_LONG_ERROR = `Data exceeds MAX_LENGTH (${MAX_LENGTH}) bytes`

function ProtocolStream (readableIPC, writableIPC, isParent, onerror, onhandshake, onmessage) {
  if (!(readableIPC instanceof stream.Readable)) {
    throw new Error(`Readable IPC stream given is not an instance of stream.Readable`)
  }
  if (!(writableIPC instanceof stream.Writable)) {
    throw new Error(`Writable IPC stream given is not an instance of stream.Writable`)
  }
  if (typeof onerror !== 'function') {
    throw new Error('onerror is not a function')
  }
  if (typeof onhandshake !== 'function') {
    throw new Error('onhandshake is not a function')
  }
  if (typeof onmessage !== 'function') {
    throw new Error('onmessage is not a function')
  }

  this.readableIPC = readableIPC
  this.writableIPC = writableIPC
  this.isParent = isParent
  this.handshakeComplete = false

  // onerror and onhandshake are one-time handlers.
  this.onerror = onerror
  this.onhandshake = onhandshake

  this.onmessage = onmessage

  // If everything broke, this is lets us know when to stop everything
  // we're doing
  this.aborted = false

  // Receiving state
  this.recvLen = null
  this.recvData = []
  this.recvDataRecvLen = 0
  this.recvDataTargetLen = null

  // Sending state
  this.sendQueue = []
  this.processingSendQueue = false

  readableIPC.on('data', data => this.handleData(data))
}

// Parses the next chunk of data
// If the handshake is not complete, it expects the first byte to be either
// 0x01 if isParent = true, and 0x00 otherwise
ProtocolStream.prototype.handleData = function handleData (data) {
  if (this.aborted) return

  let cur = 0

  if (!this.handshakeComplete) {
    // The first byte is *always* the handshake message
    const byte = data[0]

    // Handshake handling
    if (this.isParent) {
      if (byte !== 0x01) {
        return this.abort(new Error(`Invalid handshake message (expected 1, got ${byte})`))
      }
    } else {
      if (byte !== 0x00) {
        return this.abort(new Error(`Invalid handshake message (expected 0, got ${byte})`))
      }
    }
    this.handshakeComplete = true
    this.onhandshake()
    cur++
  }

  // Make sure we have remaining data to work with before continuing
  if (!(data.length - cur)) return

  while (true) {
    // If we don't know the data length, then we're at the part of parsing the
    // payload length
    let recvDataTargetLen = this.recvDataTargetLen
    if (recvDataTargetLen === null) {
      // Payload length
      const recvLen = this.recvLen
      if (!recvLen) {
        // Beginning of payload length

        // Slice four bytes or remaining buffer length from cursor, whichever is
        // smaller
        let sliceDistance = Math.min(4, (data.length - cur))
        this.recvLen = data.slice(cur, cur + sliceDistance)

        // Adjust cursor
        cur += sliceDistance
      } else if (recvLen.length !== 4) {
        // Middle of payload length

        // Slice the remaining about of bytes we need to complete the length or
        // remaining buffer length from cursor, whichever is smaller
        let sliceDistance = Math.min((4 - recvLen.length), (data.length - cur))
        this.recvLen = Buffer.concat(
          // Buffers
          [recvLen, data.slice(cur, cur + sliceDistance)],
          // Buffer lengths
          (recvLen.length + sliceDistance)
        )

        // Adjust cursor
        cur += sliceDistance
      }
      // Else we're working with payload data, and the cursor does not need to be
      // moved

      // If the payload length buffer is complete, then set recvDataTargetLen for
      // future use
      if (this.recvLen.length === 4) {
        recvDataTargetLen = this.recvDataTargetLen = this.recvLen.readUInt32BE(0, true)
      }

      // Make sure we have remaining data to work with before continuing
      if (!(data.length - cur)) return
    }

    // If at this stage, then this guarantees that we have data to work with
    // because we cannot have a handshake -> payload data parse jump and
    // the payload length parse footer did not return due to "no more data"

    if (this.recvDataRecvLen !== recvDataTargetLen) {
      // Payload data

      // Slice the remaining about of bytes we need to complete the length or
      // remaining buffer length from cursor, whichever is smaller
      let sliceDistance = Math.min((recvDataTargetLen - this.recvDataRecvLen), (data.length - cur))
      const slice = data.slice(cur, cur + sliceDistance)
      this.recvData.push(slice)
      this.recvDataRecvLen += slice.length

      // Adjust cursor
      cur += slice.length
    }

    // Check to see if we have all the payload data we need
    if (this.recvDataRecvLen === recvDataTargetLen) {
      // Payload data is complete, reset state and call message handler
      const finalData = this.recvData

      this.recvLen = null
      this.recvData = []
      this.recvDataRecvLen = 0
      this.recvDataTargetLen = null

      // TODO: Do we need this?
      // Investigate following flow:
      //   handshake ->
      //   handshake handler ->
      //   message handler attach ->
      //   message -> <== Done before message handler gets to be attached?
      //   mesasge handler
      //
      // If message handler calls come _before_ the message handler attaching,
      // then we'll have to probably either keep setImmediate
      // (process.nextTick?) and/or have a special during-handshake message
      // queue to drain immediately after init()' resolution (by then we
      // expect the message handler to be attached in that execution stack)
      setImmediate(() => {
        this.onmessage(Buffer.concat(finalData))
      })
    }

    // Make sure we have remaining data to work with before continuing
    if (!(data.length - cur)) return
  }
}

// Aborts the stream parser. Prevents further actions taken.
ProtocolStream.prototype.abort = function abort (err) {
  this.aborted = true
  this.onerror(err)
}

// Processes the queue, message by message.
ProtocolStream.prototype.processSendQueue = function processSendQueue () {
  const processNext = () => {
    if (!this.sendQueue.length) {
      this.processingSendQueue = false
      return
    }
    this.processingSendQueue = true
    const queueItem = this.sendQueue.shift()
    const data = queueItem[0]
    const cb = queueItem[1]
    let drained = true
    try {
      // If there's a stream error, let the stream emit it via 'error' event
      drained = this.writableIPC.write(data)
    } catch (err) {}
    if (!drained) {
      this.writableIPC.once('drain', () => {
        cb()
        // TODO: Will doing this without a nextTick cause a max stack error?
        //       I'm only assuming that 'drain' evt is done in a new stack.
        processNext()
      })
    } else {
      cb()
      // TODO: Will omitting this cause a max stack error?
      process.nextTick(() => {
        processNext()
      })
    }
  }
  processNext()
}

// Queues data to be sent to the stream.
// Helps make sure that data is not sent out of order, as we don't concat
// the buffers to save memory (esp on large messages)
//
// We need this due to us needing to handle stream drains, because otherwise
// we have the potential to lose data that's being sent.
ProtocolStream.prototype.queueSend = function queueSend (data, cb) {
  this.sendQueue.push([data, cb])
  if (!this.processingSendQueue) {
    this.processSendQueue()
  }
}

// Sends message to the stream
// Returns a Promise that always resolves
ProtocolStream.prototype.send = function send (data) {
  return new Promise((resolve, reject) => {
    if (!(data instanceof Buffer)) {
      throw new Error('Data must be a Buffer instance')
    }

    const dataLength = data.length

    if (dataLength > MAX_LENGTH) {
      throw new Error(TOO_LONG_ERROR)
    }

    let sentCt = 0
    const check = () => {
      sentCt++
      if (sentCt === 2) resolve()
    }

    // Payload length
    const lenBuf = Buffer.allocUnsafe(4)
    lenBuf.writeUInt32BE(dataLength, 0, true)
    this.queueSend(lenBuf, check)

    // Payload data
    this.queueSend(data, check)
  })
}

module.exports = ProtocolStream
