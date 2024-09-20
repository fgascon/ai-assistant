import { Device } from "../../device";

export type KasaDeviceInfo = {
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

export abstract class KasaDevice extends Device {
  public readonly ip: string;
  public readonly port: number;

  constructor(info: KasaDeviceInfo) {
    super({
      id: info.deviceId,
      name: info.alias || info.deviceName,
      manufacturer: "kasa",
      model: info.model,
      integration: "kasa",
    });
    this.ip = info.ip;
    this.port = info.port;
  }
}
