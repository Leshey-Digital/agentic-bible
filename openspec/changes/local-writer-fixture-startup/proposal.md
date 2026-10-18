# Local writer fixture startup

The controlled canonical writer fixture constructs its owned Git baseline with synchronous subprocesses. Running that setup after local D1 is already serving requests can prevent the Node event loop from handling expired Miniflare loopback connections before the next evidence read.

Construct the same Git baseline before starting local D1. The baseline still captures the same project files, and generation still completes before any writer call. Keep database failures strict and retain every writer assertion, request bound and replay guard.

This is a test fixture scheduling correction. Application code, database schema, dependency versions, provider transports, release journals and production resources remain outside the change. It adds no retry, timeout extension, credential or paid call.
