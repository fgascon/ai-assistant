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
  public readonly deviceId: string;

  constructor(info: KasaDeviceInfo) {
    super({
      name: info.alias || info.deviceName,
      brand: "kasa",
      model: info.model,
    });
    this.ip = info.ip;
    this.port = info.port;
    this.deviceId = info.deviceId;
  }
}
