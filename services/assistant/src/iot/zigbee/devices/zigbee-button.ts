import type { Definition } from "zigbee-herdsman-converters";
import { DeviceType } from "../../device";
import type InternalZigbeeDevice from "../model/device";
import { ZigbeeDevice } from "./base-zigbee-device";

export class ZigbeeButton extends ZigbeeDevice {
  readonly type = DeviceType.Button;

  constructor(internalDevice: InternalZigbeeDevice, definition: Definition) {
    super(internalDevice, definition);
  }
}
