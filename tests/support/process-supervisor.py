#!/usr/bin/env python3
"""Run a Wrangler process tree that stays in its owned session and reap its orphans."""

import ctypes
import os
import signal
import subprocess
import sys
import time


PR_SET_CHILD_SUBREAPER = 36
PR_SET_PDEATHSIG = 1
TERM_GRACE_SECONDS = 1.0


def enable_subreaper():
    if sys.platform != "linux":
        raise RuntimeError("owned process reaping requires Linux subreaper support")
    libc = ctypes.CDLL(None, use_errno=True)
    libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong]
    libc.prctl.restype = ctypes.c_int
    if libc.prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) != 0:
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code))


def group_exists(group):
    try:
        os.killpg(group, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def reap_adopted():
    while True:
        try:
            pid, _ = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            return
        if pid == 0:
            return


def stop_group(group, child):
    try:
        os.killpg(group, signal.SIGTERM)
    except ProcessLookupError:
        pass

    deadline = time.monotonic() + TERM_GRACE_SECONDS
    while time.monotonic() < deadline:
        child.poll()
        reap_adopted()
        if not group_exists(group):
            break
        time.sleep(0.02)

    if group_exists(group):
        try:
            os.killpg(group, signal.SIGKILL)
        except ProcessLookupError:
            pass

    while group_exists(group):
        child.poll()
        reap_adopted()
        time.sleep(0.01)
    child.wait()
    reap_adopted()


def main():
    try:
        expected_parent = int(sys.argv[sys.argv.index("--parent-pid") + 1])
        separator = sys.argv.index("--")
        command = sys.argv[separator + 1 :]
        if not command:
            raise ValueError("missing supervised command")
        enable_subreaper()
    except (ValueError, OSError, RuntimeError) as error:
        print("process_supervisor_setup_failed: " + str(error), file=sys.stderr)
        return 125

    requested_stop = False
    requested_signal = signal.SIGTERM

    def request_stop(signum, _frame):
        nonlocal requested_signal, requested_stop
        requested_signal = signum
        requested_stop = True

    signal.signal(signal.SIGTERM, request_stop)
    signal.signal(signal.SIGINT, request_stop)

    libc = ctypes.CDLL(None, use_errno=True)
    libc.prctl.argtypes = [ctypes.c_int, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_ulong]
    libc.prctl.restype = ctypes.c_int
    if libc.prctl(PR_SET_PDEATHSIG, signal.SIGTERM, 0, 0, 0) != 0:
        code = ctypes.get_errno()
        print("process_supervisor_parent_guard_failed: " + os.strerror(code), file=sys.stderr)
        return 125
    if os.getppid() != expected_parent:
        requested_stop = True

    if requested_stop:
        return 128 + requested_signal

    try:
        child = subprocess.Popen(command, start_new_session=True)
    except OSError as error:
        print("process_supervisor_spawn_failed: " + str(error), file=sys.stderr)
        return 127

    status = None
    while status is None and not requested_stop:
        status = child.poll()
        if status is None:
            time.sleep(0.02)

    stop_group(child.pid, child)
    if requested_stop:
        return 128 + requested_signal
    return status if status is not None else 1


if __name__ == "__main__":
    raise SystemExit(main())
