'use strict'

const Worker = require('./Worker')
const Connection = require('./Connection')

// Creates an initialized worker.
// Returns a Promise that:
// - resolves with the initialized worker
// - rejects with any error encountered
exports.createWorker = async function createWorker (command, args, options) {
  const worker = new Worker(command, args, options)
  await worker.init()
  return worker
}

// Connects to the parent process's IPC (fd 3) if the process is
// a worker process
// Returns a Promise that:
// - resolves with the initialized connection
// - rejects with any error encountered
exports.connect = async function connect () {
  const connection = new Connection()
  await connection.init()
  return connection
}
