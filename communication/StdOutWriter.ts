import process from "node:process";
import { DataResponseMessage, Message } from "./Message.ts";
import { FormatTextResponseMessage } from "./Message.ts";
import { ErrorResponseMessage } from "./Message.ts";
import { SuccessResponseMessage } from "./Message.ts";
import { MessageWriter } from "./ReaderWriter.ts";

const encoder = new TextEncoder();

export class StdoutWriter {
  // todo: don't use an array for a queue
  #queue: Message[] = [];
  #id = new IdGenerator();
  #writer: MessageWriter;
  #processingPromise: Promise<void> | undefined = undefined;

  constructor(writer: MessageWriter) {
    this.#writer = writer;
  }

  waitNotProcessing() {
    if (this.#processingPromise) {
      return this.#processingPromise;
    } else {
      return Promise.resolve();
    }
  }

  sendSuccessResponse(originalMessageId: number) {
    this.sendMessage(this.#getNextSuccessResponse(originalMessageId));
  }

  #getNextSuccessResponse(originalMessageId: number) {
    return new SuccessResponseMessage(this.#id.next(), originalMessageId);
  }

  sendDataResponse(originalMessageId: number, text: string) {
    this.sendDataResponseBytes(originalMessageId, encoder.encode(text));
  }

  sendDataResponseBytes(originalMessageId: number, data: Uint8Array) {
    this.sendMessage(
      new DataResponseMessage(this.#id.next(), originalMessageId, data),
    );
  }

  sendError(originalMessageId: number, err: unknown) {
    this.sendErrorText(originalMessageId, errorToString(err));
  }

  sendErrorText(originalMessageId: number, text: string) {
    this.sendMessage(
      new ErrorResponseMessage(
        this.#id.next(),
        originalMessageId,
        encoder.encode(text),
      ),
    );
  }

  sendFormatTextResponse(originalMessageId: number, text: string | undefined) {
    this.sendMessage(
      new FormatTextResponseMessage(
        this.#id.next(),
        originalMessageId,
        text == null ? undefined : encoder.encode(text),
      ),
    );
  }

  sendMessage(message: Message) {
    this.#queue.push(message);
    this.#maybeStartProcessing();
  }

  #maybeStartProcessing() {
    if (this.#processingPromise) {
      return;
    }

    this.#processingPromise = (async () => {
      try {
        while (this.#queue.length > 0) {
          const nextMessage = this.#queue.shift()!;
          await nextMessage.write(this.#writer);
        }
      } catch (err) {
        console.error(err);
        console.error(
          "Catastrophic error where the stdout messenger errored. Exiting.",
        );
        process.exit(1);
      }
    })().finally(() => {
      this.#processingPromise = undefined;
    });
  }
}

// deno-lint-ignore no-explicit-any
function errorToString(err: any) {
  return (err?.stack ?? err)?.toString() ?? "Unknown error.";
}

class IdGenerator {
  #counter = 0;

  next() {
    return ++this.#counter;
  }
}
