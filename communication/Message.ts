import { MessageReader, MessageWriter } from "./ReaderWriter.ts";

// this code was ported from c#
// https://github.com/dprint/dprint-plugin-roslyn/blob/5eb794d82296d879c36544f5b48f678e6b4b0783/DprintPluginRoslyn/Communication/Message.cs

export enum MessageKind {
  Success = 0,
  DataResponse = 1,
  ErrorResponse = 2,
  Shutdown = 3,
  Active = 4,
  GetPluginInfo = 5,
  GetLicenseText = 6,
  RegisterConfig = 7,
  ReleaseConfig = 8,
  GetConfigDiagnostics = 9,
  GetResolvedConfig = 10,
  FormatText = 11,
  FormatTextResponse = 12,
  CancelFormat = 13,
  HostFormat = 14,
}

export abstract class Message {
  messageId: number;
  kind: MessageKind;

  constructor(messageId: number, kind: MessageKind) {
    this.messageId = messageId;
    this.kind = kind;
  }

  async write(writer: MessageWriter) {
    await writer.writeInt(this.messageId);
    await writer.writeInt(this.kind);
    await this.writeBody(writer);
    await writer.writeSuccessBytes();
  }

  protected abstract writeBody(writer: MessageWriter): Promise<void>;

  static async read(reader: MessageReader): Promise<Message> {
    const messageId = await reader.readInt();
    const kind = (await reader.readInt()) as MessageKind;

    const message = await getMessageFromBody(messageId, kind, reader);

    await reader.readSuccessBytes();

    return message;
  }
}

async function getMessageFromBody(
  messageId: number,
  kind: MessageKind,
  reader: MessageReader,
) {
  switch (kind) {
    case MessageKind.Success:
      return new SuccessResponseMessage(messageId, await reader.readInt());
    case MessageKind.DataResponse:
      return new DataResponseMessage(
        messageId,
        await reader.readInt(),
        await reader.readVariableData(),
      );
    case MessageKind.ErrorResponse:
      return new ErrorResponseMessage(
        messageId,
        await reader.readInt(),
        await reader.readVariableData(),
      );
    case MessageKind.Shutdown:
      return new ShutdownMessage(messageId);
    case MessageKind.Active:
      return new ActiveMessage(messageId);
    case MessageKind.GetPluginInfo:
      return new GetPluginInfoMessage(messageId);
    case MessageKind.GetLicenseText:
      return new GetLicenseTextMessage(messageId);
    case MessageKind.RegisterConfig:
      return new RegisterConfigMessage(
        messageId,
        await reader.readInt(),
        await reader.readVariableData(),
        await reader.readVariableData(),
      );
    case MessageKind.ReleaseConfig:
      return new ReleaseConfigMessage(messageId, await reader.readInt());
    case MessageKind.GetConfigDiagnostics:
      return new GetConfigDiagnosticsMessage(messageId, await reader.readInt());
    case MessageKind.GetResolvedConfig:
      return new GetResolvedConfigMessage(messageId, await reader.readInt());
    case MessageKind.FormatText:
      return new FormatTextMessage(
        messageId,
        await reader.readVariableData(),
        await reader.readInt(),
        await reader.readInt(),
        await reader.readInt(),
        await reader.readVariableData(),
        await reader.readVariableData(),
      );
    case MessageKind.FormatTextResponse:
      return FormatTextResponseMessage.FromReader(messageId, reader);
    case MessageKind.CancelFormat:
      return new CancelFormatMessage(messageId, await reader.readInt());
    case MessageKind.HostFormat:
      return new HostFormatMessage(
        messageId,
        await reader.readVariableData(),
        await reader.readInt(),
        await reader.readInt(),
        await reader.readVariableData(),
        await reader.readVariableData(),
      );
    default:
      throw new Error(`Unknown message kind: ${kind}`);
  }
}

export class SuccessResponseMessage extends Message {
  originalMessageId: number;

  constructor(messageId: number, originalMessageId: number) {
    super(messageId, MessageKind.Success);
    this.originalMessageId = originalMessageId;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeInt(this.originalMessageId);
  }
}

export class DataResponseMessage extends Message {
  originalMessageId: number;
  data: Uint8Array;

  constructor(messageId: number, originalMessageId: number, data: Uint8Array) {
    super(messageId, MessageKind.DataResponse);
    this.originalMessageId = originalMessageId;
    this.data = data;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeInt(this.originalMessageId);
    await writer.writeVariableData(this.data);
  }
}

export class ErrorResponseMessage extends Message {
  originalMessageId: number;
  data: Uint8Array;

  constructor(messageId: number, originalMessageId: number, data: Uint8Array) {
    super(messageId, MessageKind.ErrorResponse);
    this.originalMessageId = originalMessageId;
    this.data = data;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeInt(this.originalMessageId);
    await writer.writeVariableData(this.data);
  }
}

export class ShutdownMessage extends Message {
  constructor(messageId: number) {
    super(messageId, MessageKind.Shutdown);
  }

  protected override writeBody(_writer: MessageWriter) {
    return Promise.resolve();
  }
}

export class ActiveMessage extends Message {
  constructor(messageId: number) {
    super(messageId, MessageKind.Active);
  }

  protected override writeBody(_writer: MessageWriter) {
    return Promise.resolve();
  }
}

export class GetPluginInfoMessage extends Message {
  constructor(messageId: number) {
    super(messageId, MessageKind.GetPluginInfo);
  }

  protected override writeBody(_writer: MessageWriter) {
    return Promise.resolve();
  }
}

export class GetLicenseTextMessage extends Message {
  constructor(messageId: number) {
    super(messageId, MessageKind.GetLicenseText);
  }

  protected override writeBody(_writer: MessageWriter) {
    return Promise.resolve();
  }
}

export class RegisterConfigMessage extends Message {
  configId: number;
  globalConfigData: Uint8Array;
  pluginConfigData: Uint8Array;

  constructor(
    messageId: number,
    configId: number,
    globalConfigData: Uint8Array,
    pluginConfigData: Uint8Array,
  ) {
    super(messageId, MessageKind.RegisterConfig);
    this.configId = configId;
    this.globalConfigData = globalConfigData;
    this.pluginConfigData = pluginConfigData;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeInt(this.configId);
    await writer.writeVariableData(this.globalConfigData);
    await writer.writeVariableData(this.pluginConfigData);
  }
}

export class ReleaseConfigMessage extends Message {
  configId: number;

  constructor(messageId: number, configId: number) {
    super(messageId, MessageKind.ReleaseConfig);
    this.configId = configId;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeInt(this.configId);
  }
}

export class GetConfigDiagnosticsMessage extends Message {
  configId: number;

  constructor(messageId: number, configId: number) {
    super(messageId, MessageKind.GetConfigDiagnostics);
    this.configId = configId;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeInt(this.configId);
  }
}

export class GetResolvedConfigMessage extends Message {
  configId: number;

  constructor(messageId: number, configId: number) {
    super(messageId, MessageKind.GetResolvedConfig);
    this.configId = configId;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeInt(this.configId);
  }
}

export class FormatTextMessage extends Message {
  filePath: Uint8Array;
  startByteIndex: number;
  endByteIndex: number;
  configId: number;
  overrideConfig: Uint8Array;
  fileText: Uint8Array;

  constructor(
    messageId: number,
    filePath: Uint8Array,
    startByteIndex: number,
    endByteIndex: number,
    configId: number,
    overrideConfig: Uint8Array,
    fileText: Uint8Array,
  ) {
    super(messageId, MessageKind.FormatText);
    this.filePath = filePath;
    this.startByteIndex = startByteIndex;
    this.endByteIndex = endByteIndex;
    this.configId = configId;
    this.overrideConfig = overrideConfig;
    this.fileText = fileText;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeVariableData(this.filePath);
    await writer.writeInt(this.startByteIndex);
    await writer.writeInt(this.endByteIndex);
    await writer.writeInt(this.configId);
    await writer.writeVariableData(this.overrideConfig);
    await writer.writeVariableData(this.fileText);
  }
}

export class FormatTextResponseMessage extends Message {
  content: Uint8Array | undefined;
  originalMessageId: number;

  constructor(
    messageId: number,
    originalMessageId: number,
    content: Uint8Array | undefined,
  ) {
    super(messageId, MessageKind.FormatTextResponse);
    this.originalMessageId = originalMessageId;
    this.content = content;
  }

  public static async FromReader(
    messageId: number,
    reader: MessageReader,
  ): Promise<FormatTextResponseMessage> {
    const originalMessageId = await reader.readInt();
    const kind = await reader.readInt();

    switch (kind) {
      case 0:
        return new FormatTextResponseMessage(
          messageId,
          originalMessageId,
          undefined,
        );
      case 1:
        return new FormatTextResponseMessage(
          messageId,
          originalMessageId,
          await reader.readVariableData(),
        );
      default:
        throw new Error(`Unknown message kind: ${kind}`);
    }
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeInt(this.originalMessageId);
    if (this.content == null) {
      await writer.writeInt(0);
    } else {
      await writer.writeInt(1);
      await writer.writeVariableData(this.content);
    }
  }
}

export class CancelFormatMessage extends Message {
  originalMessageId: number;

  constructor(messageId: number, originalMessageId: number) {
    super(messageId, MessageKind.CancelFormat);
    this.originalMessageId = originalMessageId;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeInt(this.originalMessageId);
  }
}

export class HostFormatMessage extends Message {
  filePath: Uint8Array;
  startByteIndex: number;
  endByteIndex: number;
  overrideConfig: Uint8Array;
  fileText: Uint8Array;

  constructor(
    messageId: number,
    filePath: Uint8Array,
    startByteIndex: number,
    endByteIndex: number,
    overrideConfig: Uint8Array,
    fileText: Uint8Array,
  ) {
    super(messageId, MessageKind.FormatText);
    this.filePath = filePath;
    this.startByteIndex = startByteIndex;
    this.endByteIndex = endByteIndex;
    this.overrideConfig = overrideConfig;
    this.fileText = fileText;
  }

  protected override async writeBody(writer: MessageWriter) {
    await writer.writeVariableData(this.filePath);
    await writer.writeInt(this.startByteIndex);
    await writer.writeInt(this.endByteIndex);
    await writer.writeVariableData(this.overrideConfig);
    await writer.writeVariableData(this.fileText);
  }
}
