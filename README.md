worker-process
===

Dead simple worker child processes for Node.js with a modern Promise API
and a binary IPC.

For people who don't want to use external servers for binary IPC,
don't want to mess with `child_process`, and want to use something
that "just works".

---

`master.js`

```js
// TODO
```

`worker.js`

```js
import workerProcess from 'worker-process'
import msgpack from 'msgpack-lite'

async function main () {
  // Connect to the IPC socket.
  // All nuances and errors from here on will be handled by worker-process
  // by logging the error and exiting the process with exit code 1 to
  // guarantee safety and consistency
  const workerConnection = await workerProcess.connect()

  // Handle messages from the parent process
  workerConnection.onmessage = function (message) {
    console.log('worker:message', msgpack.decode(message))
  }

  // Send messages to the parent process
  const data = ['hello', 'world!']
  await workerConnection.send(msgpack.encode(data))
}

console.log('worker:start')
main().catch(err => {
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
