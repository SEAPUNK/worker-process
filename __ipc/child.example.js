const workerProcess = require('../')
const msgpack = require('msgpack-lite')
const minico = require('minico')

const main = minico(function * main () {
  const workerConnection = yield workerProcess.connect()

  // Handle messages from the parent process
  workerConnection.onmessage = function (message) {
    console.log('worker:message', msgpack.decode(message))
  }

  // Send messages to the parent process
  const data = ['hello', 'world!']
  yield workerConnection.send(msgpack.encode(data))
})

console.log('worker:start')
main().catch(err => {
  console.error('worker:fail')
  console.error(err)
})
