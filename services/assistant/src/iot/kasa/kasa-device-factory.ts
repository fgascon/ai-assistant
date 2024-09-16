import { z } from "zod";
import { XorEncryption } from "./xorencryption";
import type { KasaDevice, KasaDeviceInfo } from "./devices/base-kasa-device";
import { KasaIotDimmer } from "./devices/kasa-iot-dimmer";
import { KasaIotSwitch } from "./devices/kasa-iot-switch";

const deviceFactories: Record<string, (info: KasaDeviceInfo) => KasaDevice> = {
  "IOT.SMARTPLUGSWITCH": (info) => {
    if (info.deviceName.includes("Dimmer")) {
      return new KasaIotDimmer(info);
    }
    return new KasaIotSwitch(info);
  },
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

export function createKasaDevice({
  ip,
  port,
  data,
}: {
  ip: string;
  port: number;
  data: Buffer;
}): KasaDevice | undefined {
  const info = JSON.parse(XorEncryption.decrypt(data)) as unknown;
  const parsedInfo = getSysinfoSchema.parse(info);
  const rawSysInfo = parsedInfo.system.get_sysinfo;
  const parsedDeviceInfo = deviceInfoSchema.parse(rawSysInfo);
  const deviceInfo: KasaDeviceInfo = {
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
