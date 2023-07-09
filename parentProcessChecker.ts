import process from "node:process";
import timers from "node:timers";

export function startParentProcessChecker(parentPid: number) {
  timers.setInterval(() => {
    if (!isProcessRunning(parentPid)) {
      process.exit(1);
    }
  }, 30_000).unref(); // ensure this doesn't keep the process alive
}

function isProcessRunning(pid: number) {
  // https://nodejs.org/api/process.html#process_process_kill_pid_signal
  try {
    // providing 0 tests for the existence of a process without killing strangely
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
