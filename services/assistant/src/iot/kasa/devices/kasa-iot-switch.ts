import { z } from "zod";
import { DeviceType, type SwitchDevice } from "../../device";
import type { KasaDeviceInfo } from "./base-kasa-device";
import { KasaIotDevice } from "./kasa-iot-device";

const iotSwitchSchema = z.object({
  relay_state: z.number(),
});

export class KasaIotSwitch extends KasaIotDevice implements SwitchDevice {
  private _relayState: number;

  constructor(info: KasaDeviceInfo) {
    super(info);
    const parsedData = iotSwitchSchema.parse(info.rawSysInfo);
    this._relayState = parsedData.relay_state;
  }

  get type(): DeviceType.Switch | DeviceType.DimmableSwitch {
    return DeviceType.Switch;
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

  async toggle() {
    await this.setRelayState(this._relayState === 0 ? 1 : 0);
  }
}
