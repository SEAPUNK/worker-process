worker-process
===

[![npm version](https://img.shields.io/npm/v/worker-process.svg?style=flat-square)](https://npmjs.com/package/worker-process)
[![javascript standard style](https://img.shields.io/badge/code%20style-standard-blue.svg?style=flat-square)](http://standardjs.com/)
[![travis build](https://img.shields.io/travis/SEAPUNK/worker-process/master.svg?style=flat-square)](https://travis-ci.org/SEAPUNK/worker-process)
[![coveralls coverage](https://img.shields.io/coveralls/SEAPUNK/worker-process.svg?style=flat-square)](https://coveralls.io/github/SEAPUNK/worker-process)
[![david dependencies](https://david-dm.org/SEAPUNK/worker-process.svg?style=flat-square)](https://david-dm.org/SEAPUNK/worker-process)
[![david dev dependencies](https://david-dm.org/SEAPUNK/worker-process/dev-status.svg?style=flat-square)](https://david-dm.org/SEAPUNK/worker-process)

Dead simple worker child processes for Node.js with a modern Promise API
and a binary IPC.

For people who don't want to use external servers for binary IPC,
don't want to mess with `child_process`, and want to use something
that "just works".

---

`master.js`

```js
import {createWorker} from 'worker-process'
import msgpack from 'msgpack-lite'

async function main () {
  // Create a worker.
  const worker = await createWorker('./worker.js')

  let gotMessage = false
  await Promise.all([
    // Wait for the worker to complete (resolve) or fail (reject).
    worker.lifetime,

    // Do what you want to do with the worker.
    (async () => {
      // Handle messages from worker process
      worker.onmessage = message => {
        console.log('master:message', msgpack.decode(message))
        gotMessage = true
      }

      // Send a message to the worker
      const data = 'hello, worker!'
      await worker.send(msgpack.encode(data))
    })()
  ])

  // If the worker exits successfully but you didn't finish what you wanted to
  // do, you can handle it
  if (!gotMessage) {
    throw new Error('Worker did not say hello :(')
  }
}

main().catch(err => {
  console.error('master:fail')
  console.error(err)
})
```

`worker.js`

```js
import {connect} from 'worker-process'
import msgpack from 'msgpack-lite'
import exit from 'exit'

async function main () {
  // Connect to the IPC socket.
  // All nuances and errors from here on will be handled by worker-process
  // by logging the error and exiting the process with exit code 1 to
  // guarantee safety and consistency
  const workerConnection = await connect()

  // Handle messages from the parent process
  workerConnection.onmessage = message => {
    console.log('worker:message', msgpack.decode(message))
  }

  // Send messages to the parent process
  const data = ['hello', 'world!']
  await workerConnection.send(msgpack.encode(data))

  // Wait for the message to complete sending, and then close the connection
  await workerConnection.finish()
}

console.log('worker:start')
main().then(() => {
  exit(0)
}).catch(err => {
  console.error('worker:fail')
  console.error(err)
})
```

---

- [API documentation](docs/api.md)
- [Binary protocol](docs/protocol.md)
- [Design rules](docs/rules.md)

I recommend using MessagePack as the IPC message format.

---

How it works
---

The "worker" process is created via `child_process.spawn()`. At spawn, a fourth
stdio is created (`fd = 3`), which is a node.js duplex stream because node.js
[creates a duplex socket](https://github.com/nodejs/help/issues/321), rather
than a pipe for communication. When the child process is connected, connectivity
is assured by sending the handshake message, `0x00`, and waiting for the worker
process to send `0x01` back. From there, data is passed back and forth using the
[binary protocol](docs/protocol.md).
