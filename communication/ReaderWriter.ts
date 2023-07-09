import fs from "node:fs";
import process from "node:process";
import { Buffer } from "node:buffer";

const isWindows = process.platform === "win32";

export class MessageReader {
  readInt() {
    return withStdin((stdin) => this.readIntFromStdIn(stdin));
  }

  readSuccessBytes() {
    return withStdin(async (stdin) => {
      const buf = Buffer.alloc(4);
      await this.readBuf(stdin, buf, 0, 4);
      for (let i = 0; i < buf.length; i++) {
        if (buf[i] !== 255) {
          console.error(
            `Catastrophic error. Expected success bytes, but found: [${
              buf.join(", ")
            }]`,
          );
          process.exit(1);
        }
      }
    });
  }

  readVariableData() {
    return withStdin(async (stdin) => {
      const size = await this.readIntFromStdIn(stdin);
      const buffer = Buffer.alloc(size);
      if (size > 0) {
        await this.readBuf(stdin, buffer, 0, size);
      }

      return buffer;
    });
  }

  private async readIntFromStdIn(stdin: number) {
    const buf = Buffer.alloc(4);
    await this.readBuf(stdin, buf, 0, 4);
    return buf.readUInt32BE();
  }

  private readBuf(
    stdin: number,
    buffer: Buffer,
    offset: number,
    length: number,
  ) {
    return new Promise<void>((resolve, reject) => {
      try {
        fs.read(stdin, buffer, offset, length, null, (err, bytesRead) => {
          if (err) {
            reject(err);
          } else if (bytesRead !== length) {
            // be strict here because this indicates an error
            reject(
              new Error(
                `The number of bytes read was ${bytesRead}, but expected ${length}`,
              ),
            );
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

export class MessageWriter {
  writeInt(value: number) {
    return withStdout((stdout) => this.writeIntToStdOut(stdout, value));
  }

  writeVariableData(buffer: Uint8Array) {
    return withStdout(async (stdout) => {
      await this.writeIntToStdOut(stdout, buffer.length);
      await this.writeBuf(stdout, buffer, 0, buffer.length);
    });
  }

  writeSuccessBytes() {
    return withStdout((stdout) => {
      const buf = Buffer.alloc(4, 255); // fill 4 bytes with value 255
      return this.writeBuf(stdout, buf, 0, 4);
    });
  }

  private writeIntToStdOut(stdout: number, value: number) {
    const buf = Buffer.alloc(4);
    buf.writeUInt32BE(value);
    return this.writeBuf(stdout, buf, 0, buf.length);
  }

  private writeBuf(
    stdout: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
  ) {
    return new Promise<void>((resolve, reject) => {
      try {
        fs.write(stdout, buffer, offset, length, (err, bytesWritten) => {
          if (err) {
            reject(err);
          } else if (bytesWritten !== length) {
            // be strict here because this indicates an error
            reject(
              new Error(
                `The number of bytes written was ${bytesWritten}, but expected ${length}`,
              ),
            );
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}

function withStdin<T = void>(action: (stdin: number) => Promise<T>) {
  if (isWindows) {
    return action(process.stdin.fd);
  } else {
    // This is necessary on linux because it errors with process.stdin.fd
    // and on windows it can't find /dev/stdin
    return withDescriptor("/dev/stdin", "rs", action);
  }
}

function withStdout<T = void>(action: (stdout: number) => Promise<T>) {
  if (isWindows) {
    return action(process.stdout.fd);
  } else {
    return withDescriptor("/dev/stdout", "w", action);
  }
}

async function withDescriptor<T = void>(
  name: string,
  flags: string,
  action: (fd: number) => Promise<T>,
) {
  const fd = fs.openSync(name, flags); // todo: async
  try {
    return await action(fd);
  } finally {
    fs.closeSync(fd);
  }
}
