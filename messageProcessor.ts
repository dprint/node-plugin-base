import {
  MessageReader,
  MessageWriter,
  StdoutWriter,
} from "./communication/mod.ts";
import {
  ActiveMessage,
  CancelFormatMessage,
  DataResponseMessage,
  ErrorResponseMessage,
  FormatTextMessage,
  GetConfigDiagnosticsMessage,
  GetLicenseTextMessage,
  GetPluginInfoMessage,
  GetResolvedConfigMessage,
  HostFormatMessage,
  Message,
  RegisterConfigMessage,
  ReleaseConfigMessage,
  ShutdownMessage,
  SuccessResponseMessage,
} from "./communication/Message.ts";
import { ConfigContainer } from "./ConfigContainer.ts";

const decoder = new TextDecoder();

export interface PluginInfo {
  name: string;
  version: string;
  configKey: string;
  fileExtensions: string[];
  helpUrl: string;
  configSchemaUrl: string;
  updateUrl: string;
}

export type JsonObject = Record<string, string | number | boolean>;

export interface ConfigDiagnostic {
  propertyName: string;
  message: string;
}

export interface ResolveConfigResult<TConfig> {
  config: TConfig;
  diagnostics: ConfigDiagnostic[];
}

export interface FormatRequest<TConfig> {
  filePath: string;
  fileText: string;
  config: TConfig;
  /// Range to format as a JS string position.
  range: [number, number] | undefined;
  signal: AbortSignal;
}

export interface PluginHandler<TConfig> {
  pluginInfo(): PluginInfo;
  licenseText(): string;
  resolveConfig(
    pluginConfig: JsonObject,
    globalConfig: JsonObject,
  ): ResolveConfigResult<TConfig>;
  formatText(request: FormatRequest<TConfig>): Promise<string>;
}

export async function startMessageProcessor<TConfig>(
  plugin: PluginHandler<TConfig>,
) {
  const reader = new MessageReader();
  const writer = new MessageWriter();

  await establishSchemaVersion(reader, writer);

  const stdoutWriter = new StdoutWriter(writer);
  const configContainer = new ConfigContainer((pluginConfig, globalConfig) => {
    return plugin.resolveConfig(pluginConfig, globalConfig);
  });
  const abortControllers = new Map<number, AbortController>();

  function tryActionSync(originalMessageId: number, action: () => void) {
    try {
      action();
    } catch (err) {
      stdoutWriter.sendError(originalMessageId, err);
    }
  }

  function parseJsonObject(data: Uint8Array): JsonObject {
    const obj = JSON.parse(decoder.decode(data)) as JsonObject;
    if (typeof obj !== "object" || obj === null) {
      throw new Error("Expected JSON object");
    }
    return obj;
  }

  while (true) {
    const message = await Message.read(reader);

    // order these by most common to least common
    if (message instanceof FormatTextMessage) {
      const _ignore = (async () => {
        const controller = new AbortController();
        abortControllers.set(message.messageId, controller);
        const signal = controller.signal;
        try {
          const filePath = decoder.decode(message.filePath);
          const fileText = decoder.decode(message.fileText);
          const overrideConfig = message.overrideConfig == null
            ? undefined
            : parseJsonObject(message.overrideConfig);
          const config = configContainer.getResolvedConfig(
            message.configId,
            overrideConfig,
          );
          const range = getFormatTextRange(message, fileText);
          const text = await plugin.formatText({
            filePath,
            fileText,
            range,
            config,
            signal,
          });
          stdoutWriter.sendFormatTextResponse(message.messageId, text);
        } catch (err) {
          stdoutWriter.sendError(message.messageId, err);
        } finally {
          abortControllers.delete(message.messageId);
        }
      })();
    } else if (message instanceof RegisterConfigMessage) {
      tryActionSync(message.messageId, () => {
        const globalConfig = parseJsonObject(message.globalConfigData);
        const pluginConfig = parseJsonObject(message.pluginConfigData);
        configContainer.set(message.configId, globalConfig, pluginConfig);
        stdoutWriter.sendSuccessResponse(message.messageId);
      });
    } else if (message instanceof ReleaseConfigMessage) {
      tryActionSync(message.messageId, () => {
        configContainer.release(message.configId);
        stdoutWriter.sendSuccessResponse(message.messageId);
      });
    } else if (message instanceof GetConfigDiagnosticsMessage) {
      tryActionSync(message.messageId, () => {
        const configDiagnostics = configContainer.getDiagnostics(
          message.configId,
        );
        stdoutWriter.sendDataResponse(
          message.messageId,
          JSON.stringify(configDiagnostics),
        );
      });
    } else if (message instanceof GetResolvedConfigMessage) {
      tryActionSync(message.messageId, () => {
        const resolvedConfig = configContainer.getResolvedConfig(
          message.configId,
          undefined,
        );
        stdoutWriter.sendDataResponse(
          message.messageId,
          JSON.stringify(resolvedConfig),
        );
      });
    } else if (message instanceof CancelFormatMessage) {
      try {
        const controller = abortControllers.get(message.originalMessageId);
        if (controller) {
          controller.abort();
          abortControllers.delete(message.originalMessageId);
        }
      } catch (err) {
        // ignore, but surface the error
        console.error(err);
      }
    } else if (message instanceof GetPluginInfoMessage) {
      const pluginInfo = plugin.pluginInfo();
      stdoutWriter.sendDataResponse(
        message.messageId,
        JSON.stringify(pluginInfo),
      );
    } else if (message instanceof GetLicenseTextMessage) {
      const licenseText = plugin.licenseText();
      stdoutWriter.sendDataResponse(message.messageId, licenseText);
    } else if (message instanceof ShutdownMessage) {
      // send a success acknowledgement
      stdoutWriter.sendSuccessResponse(message.messageId);
      // wait for the message to finish writing
      await stdoutWriter.waitNotProcessing();
      return; // done
    } else if (message instanceof ActiveMessage) {
      stdoutWriter.sendSuccessResponse(message.messageId);
    } else if (message instanceof ErrorResponseMessage) {
      // ignore
    } else if (message instanceof SuccessResponseMessage) {
      // ignore
    } else if (message instanceof DataResponseMessage) {
      // ignore
    } else if (message instanceof HostFormatMessage) {
      stdoutWriter.sendError(
        message.messageId,
        new Error("Cannot host format with a plugin."),
      );
    } else {
      console.error("Unknown message.", message);
      throw new Error("Unimplemented message kind.");
    }
  }
}

function getFormatTextRange(
  message: FormatTextMessage,
  fileText: string,
): [number, number] | undefined {
  if (
    message.startByteIndex === 0 &&
    message.endByteIndex === message.fileText.length
  ) {
    return undefined;
  }
  // we need to convert utf8 byte indexes to utf16 code unit indexes,
  // so we do this absolutely terrible thing for performance because I'm not
  // sure how to do this otherwise
  const startIndex = message.startByteIndex === 0
    ? 0
    : decoder.decode(message.fileText.slice(0, message.startByteIndex)).length;
  const endIndex = message.endByteIndex === message.fileText.length
    ? fileText.length
    : decoder.decode(message.fileText.slice(0, message.endByteIndex)).length;
  return [startIndex, endIndex];
}

async function establishSchemaVersion(
  reader: MessageReader,
  writer: MessageWriter,
) {
  // 1. An initial `0` (4 bytes) is sent asking for the schema version.
  const request = await reader.readInt();
  if (request != 0) {
    throw new Error("Expected a schema version request of `0`.");
  }

  // 2. The client responds with `0` (4 bytes) for success, then `4` (4 bytes) for the schema version.
  await writer.writeInt(0);
  await writer.writeInt(4);
}
