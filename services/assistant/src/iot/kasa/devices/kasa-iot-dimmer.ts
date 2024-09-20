import { z } from "zod";
import type { KasaDeviceInfo } from "./base-kasa-device";
import { KasaIotSwitch } from "./kasa-iot-switch";
import { DeviceType, type DimmableDevice } from "../../device";

const iotDimmerSchema = z.object({
  brightness: z.number().nullish(),
});

export class KasaIotDimmer extends KasaIotSwitch implements DimmableDevice {
  private _brightness: number;

  constructor(info: KasaDeviceInfo) {
    super(info);
    const parsedData = iotDimmerSchema.parse(info.rawSysInfo);
    this._brightness = parsedData.brightness ?? 100;
  }

  override get type(): DeviceType.DimmableSwitch {
    return DeviceType.DimmableSwitch;
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

  override get detailsForLLM() {
    return {
      ...super.detailsForLLM,
      brightness: this.brightness,
    };
  }
}
