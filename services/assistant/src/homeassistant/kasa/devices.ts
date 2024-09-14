import { z } from "zod";
import { XorEncryption } from "./xorencryption";
import { IotTransport } from "./iot-transport";

export type DeviceInfo = {
  ip: string;
  port: number;
  micType: string;
  model: string;
  deviceId: string;
  alias: string | undefined;
  mac: string;
  deviceName: string;
  rawSysInfo: unknown;
};

const getSysinfoSchema = z.object({
  system: z.object({
    get_sysinfo: z.unknown(),
  }),
});

const deviceInfoSchema = z.object({
  mic_type: z.string(),
  model: z.string(),
  deviceId: z.string(),
  alias: z.string().nullish(),
  mac: z.string(),
  dev_name: z.string(),
});

export abstract class Device {
  public readonly ip: string;
  public readonly port: number;
  public readonly model: string;
  public readonly deviceId: string;
  public readonly name: string;
  public abstract readonly state: boolean;

  constructor(info: DeviceInfo) {
    this.ip = info.ip;
    this.port = info.port;
    this.model = info.model;
    this.deviceId = info.deviceId;
    this.name = info.alias || info.deviceName;
  }

  abstract turnOn(): Promise<void>;
  abstract turnOff(): Promise<void>;
}

abstract class IotDevice extends Device {
  private transport: IotTransport;

  constructor(info: DeviceInfo) {
    super(info);
    this.transport = new IotTransport({ ip: info.ip, port: info.port });
  }

  protected async rawQuery(query: unknown) {
    return this.transport.query(query);
  }

  protected async queryHelper(service: string, target: string, value: unknown) {
    const response = await this.rawQuery({
      [service]: { [target]: value },
    });
    const result = z
      .object({
        [service]: z.object({
          [target]: z.object({ err_code: z.number() }),
        }),
      })
      .safeParse(response);
    if (!result.success) {
      throw new Error(
        `Failed to parse response from device: ${result.error.message}`,
        { cause: result.error },
      );
    }
    const errorCode = result.data[service]![target]!.err_code;
    if (errorCode !== 0) {
      throw new Error(`Failed to call device. Error code: ${errorCode}`);
    }
  }
}

const iotSwitchSchema = z.object({
  relay_state: z.number(),
});

export class IotSwitch extends IotDevice {
  private _relayState: number;

  constructor(info: DeviceInfo) {
    super(info);
    const parsedData = iotSwitchSchema.parse(info.rawSysInfo);
    this._relayState = parsedData.relay_state;
  }

  get state() {
    return Boolean(this._relayState);
  }

  private async setRelayState(state: number) {
    await this.queryHelper("system", "set_relay_state", { state });
    this._relayState = state;
  }

  async turnOn() {
    await this.setRelayState(1);
  }

  async turnOff() {
    await this.setRelayState(0);
  }
}

const iotDimmerSchema = z.object({
  brightness: z.number().nullish(),
});

export class IotDimmer extends IotSwitch {
  private _brightness: number | undefined;

  constructor(info: DeviceInfo) {
    super(info);
    const parsedData = iotDimmerSchema.parse(info.rawSysInfo);
    this._brightness = parsedData.brightness ?? undefined;
  }

  get brightness() {
    return this._brightness;
  }

  async setBrightness(brightness: number) {
    if (brightness < 0 || brightness > 100) {
      throw new Error("Brightness must be between 0 and 100");
    }

    // Dimmers do not support a brightness of 0, but bulbs do.
    // Coerce 0 to 1 to maintain the same interface between dimmers and bulbs.
    if (brightness === 0) {
      brightness = 1;
    }
    await this.queryHelper("smartlife.iot.dimmer", "set_brightness", {
      brightness,
    });
    this._brightness = brightness;
  }
}

const deviceFactories: Record<string, (info: DeviceInfo) => Device> = {
  "IOT.SMARTPLUGSWITCH": (info) => {
    if (info.deviceName.includes("Dimmer")) {
      return new IotDimmer(info);
    }
    return new IotSwitch(info);
  },
};

export function createDevice({
  ip,
  port,
  data,
}: {
  ip: string;
  port: number;
  data: Buffer;
}): Device | undefined {
  const info = JSON.parse(XorEncryption.decrypt(data)) as unknown;
  const parsedInfo = getSysinfoSchema.parse(info);
  const rawSysInfo = parsedInfo.system.get_sysinfo;
  const parsedDeviceInfo = deviceInfoSchema.parse(rawSysInfo);
  const deviceInfo: DeviceInfo = {
    ip,
    port,
    micType: parsedDeviceInfo.mic_type,
    model: parsedDeviceInfo.model,
    deviceId: parsedDeviceInfo.deviceId,
    alias: parsedDeviceInfo.alias ?? undefined,
    mac: parsedDeviceInfo.mac,
    deviceName: parsedDeviceInfo.dev_name,
    rawSysInfo,
  };
  const factory = deviceFactories[deviceInfo.micType];
  if (!factory) {
    return undefined;
  }
  return factory(deviceInfo);
}
