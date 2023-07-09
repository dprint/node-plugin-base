import { JsonObject, ResolveConfigResult } from "./messageProcessor.ts";

interface StoredConfig<TConfig> {
  globalConfig: JsonObject;
  pluginConfig: JsonObject;
  resolveContext: Lazy<ResolveConfigResult<TConfig>>;
}

export class ConfigContainer<TConfig> {
  #configs: Map<number, StoredConfig<TConfig>> = new Map();
  #resolveConfigCallback: (
    pluginConfig: JsonObject,
    globalConfig: JsonObject,
  ) => ResolveConfigResult<TConfig>;

  constructor(
    resolveConfig: (
      pluginConfig: JsonObject,
      globalConfig: JsonObject,
    ) => ResolveConfigResult<TConfig>,
  ) {
    this.#resolveConfigCallback = resolveConfig;
  }

  set(configId: number, globalConfig: JsonObject, pluginConfig: JsonObject) {
    this.#configs.set(configId, {
      globalConfig,
      pluginConfig,
      resolveContext: new Lazy(() =>
        this.#resolveConfig(pluginConfig, globalConfig, undefined)
      ),
    });
  }

  #resolveConfig(
    pluginConfig: JsonObject,
    globalConfig: JsonObject,
    overrideConfig: JsonObject | undefined,
  ) {
    if (overrideConfig != null) {
      pluginConfig = { ...pluginConfig };
      for (const prop of Object.keys(overrideConfig)) {
        pluginConfig[prop] = overrideConfig[prop];
      }
    }
    return this.#resolveConfigCallback(pluginConfig, globalConfig);
  }

  release(configId: number) {
    this.#configs.delete(configId);
  }

  getResolvedConfig(configId: number, overrideConfig: JsonObject | undefined) {
    const config = this.#getStoredConfig(configId);
    if (overrideConfig == null || Object.keys(overrideConfig).length === 0) {
      return config.resolveContext.value.config;
    } else {
      return this.#resolveConfig(
        config.pluginConfig,
        config.globalConfig,
        overrideConfig,
      ).config;
    }
  }

  getDiagnostics(configId: number) {
    const config = this.#getStoredConfig(configId);
    return config.resolveContext.value.diagnostics;
  }

  #getStoredConfig(configId: number) {
    const config = this.#configs.get(configId);
    if (config == null) {
      throw new Error(`Config '${configId}' not found`);
    }
    return config;
  }
}

class Lazy<T> {
  #value: T | undefined = undefined;
  #getValue: () => T;

  constructor(getValue: () => T) {
    this.#getValue = getValue;
  }

  get value() {
    if (this.#value == null) {
      this.#value = this.#getValue();
    }
    return this.#value;
  }
}
