import type { CustomClusters } from "zigbee-herdsman/dist/zspec/zcl/definition/tstype";
import * as zh from "../zh-types";
import * as zhc from "zigbee-herdsman-converters";

type KeyValue = Record<string, unknown>;

interface DeviceOptions {
  ID?: string;
  disabled?: boolean;
  retention?: number;
  availability?: boolean | { timeout: number };
  optimistic?: boolean;
  retrieve_state?: boolean;
  debounce?: number;
  debounce_ignore?: string[];
  filtered_attributes?: string[];
  filtered_cache?: string[];
  filtered_optimistic?: string[];
  icon?: string;
  homeassistant?: KeyValue;
  legacy?: boolean;
  friendly_name?: string;
  description?: string;
  qos?: 0 | 1 | 2;
}

export default class InternalZigbeeDevice {
  public zh: zh.Device;
  public definition: zhc.Definition | null = null;
  private _definitionModelID: string | null = null;

  get ieeeAddr(): string {
    return this.zh.ieeeAddr;
  }
  get ID(): string {
    return this.zh.ieeeAddr;
  }
  get options(): DeviceOptions {
    return {
      //...settings.get().device_options,
      //...settings.getDevice(this.ieeeAddr),
    };
  }
  get defaultName(): string {
    return this.zh.type === "Coordinator"
      ? "Coordinator"
      : this.options?.friendly_name || this.ieeeAddr;
  }
  get isSupported(): boolean {
    return (
      (this.zh.type === "Coordinator" ||
        (this.definition && !this.definition.generated)) ??
      false
    );
  }
  get customClusters(): CustomClusters {
    return this.zh.customClusters;
  }

  constructor(device: zh.Device) {
    this.zh = device;
  }

  exposes(): zhc.Expose[] {
    if (typeof this.definition?.exposes == "function") {
      const options = this.options as unknown as KeyValue;
      return this.definition?.exposes(this.zh, options);
    } else {
      return this.definition?.exposes ?? [];
    }
  }

  async resolveDefinition(ignoreCache = false): Promise<void> {
    if (
      !this.zh.interviewing &&
      (!this.definition ||
        this._definitionModelID !== this.zh.modelID ||
        ignoreCache)
    ) {
      this.definition = await zhc.findByDevice(this.zh, true);
      this._definitionModelID = this.zh.modelID ?? null;
    }
  }

  ensureInSettings(): void {
    /*if (
      this.zh.type !== "Coordinator" &&
      !settings.getDevice(this.zh.ieeeAddr)
    ) {
      settings.addDevice(this.zh.ieeeAddr);
    }*/
  }

  endpoint(key?: string | number): zh.Endpoint | null {
    let endpoint: zh.Endpoint | undefined = undefined;
    if (key == null || key == "") key = "default";

    if (!isNaN(Number(key))) {
      endpoint = this.zh.getEndpoint(Number(key));
    } else if (this.definition?.endpoint) {
      const ID = this.definition?.endpoint?.(this.zh)[key];
      if (ID) endpoint = this.zh.getEndpoint(ID);
      else if (key === "default") endpoint = this.zh.endpoints[0];
      else return null;
    } else {
      /* istanbul ignore next */
      if (key !== "default") return null;
      endpoint = this.zh.endpoints[0];
    }

    return endpoint ?? null;
  }

  endpointName(endpoint: zh.Endpoint): string | null {
    let epName = null;
    if (this.definition?.endpoint) {
      const mapping = this.definition?.endpoint(this.zh);
      for (const [name, id] of Object.entries(mapping)) {
        if (id == endpoint.ID) {
          epName = name;
        }
      }
    }
    /* istanbul ignore next */
    return epName === "default" ? null : epName;
  }

  getEndpointNames(): string[] {
    return Object.keys(this.definition?.endpoint?.(this.zh) ?? {}).filter(
      (name) => name !== "default",
    );
  }

  isIkeaTradfri(): boolean {
    return this.zh.manufacturerID === 4476;
  }

  isDevice(): this is InternalZigbeeDevice {
    return true;
  }
}
