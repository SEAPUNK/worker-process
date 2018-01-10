Design rules
===

These are rules that the current code follows to assure consistency:

1. The parent creates the worker processes, and the worker processes can be
   parents too if they create worker processes themselves.
2. The communication channel is expected to always be opened in every worker
   process, as messaging as of now is required and is part of the worker
   process. If the worker fails to open up a communication channel with the
   parent within a time slot, then it must be termnated with an error.
3. If communication between the parent and worker process breaks in any fashion,
   from the worker, then the worker must be terminated with an error (worker
   process exits with exit code 1).
4. However, if the communication channel is closed to the parent, 


This is how I expect the flow to go:

- Parent process starts
- Parent spawns worker
- Worker process starts
- Worker IPC socket is created
- Parent sends handshake (`0x00`)
- Worker sends handshake (`0x01`)
- Simultaneously:
  - Parent sends messages
  - Worker sends messages
- Worker's main code finished, `Connection.finish()` is called
- Worker waits for message backlog to complete
- Worker closes IPC socket
- Parent receives IPC socket close
- Worker process exits
- Parent process exits

Failure handling:

- Parent process starts

This is fine. Worker never gets created.

- Parent spawns worker
- Worker process starts
- Worker IPC socket is created
- Parent sends handshake (`0x00`)

This part is tricky. We have no idea if the child is actually spawned, nor how
its IPC channel is set up, so we'll be relying on the handshake to know for sure
if the process worked.

**TODO**:
  - Child fails to spawn ('error' event with no 'exit' event)
  - Child process fails to run ('error' event with a non-0 'exit' event)
  - Child process fails to run ('error' event with a 0 'exit' event)
    - Are the 'exit' events done in the same tick as 'error'? Which comes first?
  - Child process does not establish fd 3 connection (ipc 'error' event, i'd assume)

- Worker IPC socket is created

`isSocket()` check.

- Parent sends handshake (`0x00`)

Not exactly sure how this should be handled, as this could be for many reasons:

  - Process simply didn't send the message
  - Process froze
  - Process died

- Worker sends handshake (`0x01`)

Handshake timeout. If handshake is not sent within a reasonable amount of time,
then the process is killed.

**TODO**:
  - Even if the process does not handle fd 3 IPC socket, can we still send
    messages to it?
