Binary protocol
---

The binary IPC protocol is super simple. Aside from the initial `0x00`/`0x01` handshake, this is the message format:

```
  0                   1                   2                   3
  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 +---------------------------------------------------------------+
 |                     Payload length (32)                       |
 +---------------------------------------------------------------+
 |                        Payload data                           |
 + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
 |                   Payload data continued...                   |
 +---------------------------------------------------------------+
```

`Payload length`: 32 bits

32-bit big-endian unsigned integer, indicating the length of the payload data, in bytes.

`Payload data`: x bytes

Binary data message. Data cannot exceed `MAX_LENGTH` bytes, determined in [`lib/ProtocolStream.js`](../lib/ProtocolStream.js) (typically `2147483647 - 4` bytes on 64-bit systems).
