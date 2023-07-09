import process from "node:process";

export interface CliArgs {
  parentProcessId: number;
  isInit: boolean;
}

export function parseCliArgs(args?: string[]): CliArgs {
  // simple for now
  args = args ?? process.argv.slice(2);
  let parentProcessId = undefined;
  let isInit = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--parent-pid" && i + 1 < args.length) {
      parentProcessId = parseInt(args[i + 1], 10), i++;
    } else if (args[i] === "--init") {
      isInit = true;
    }
  }
  if (parentProcessId == null) {
    throw new Error("Please provide a --parent-pid <pid> flag.");
  }
  return {
    parentProcessId,
    isInit,
  };
}
