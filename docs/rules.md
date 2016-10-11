Design rules
===

These are rules that the current code follows to assure consistency:

1. The parent creates the worker processes, and the worker processes can be
   parents too if they create worker processes themselves.
2. The communication channel is expected to always be opened in every worker
   process, as messaging as of now is required and is part of the worker
   process. If the worker fails to open up a communication channel within a time
   slot, then it must be termnated with an error.
3. If communication between the parent and worker process breaks in any fashion,
   then the worker must be terminated with an error (worker process exits with exit code 1
   or parent process terminates the worker process with an error).
