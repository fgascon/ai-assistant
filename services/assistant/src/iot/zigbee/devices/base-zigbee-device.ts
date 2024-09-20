import type { Definition } from "zigbee-herdsman-converters";
import { Device } from "../../device";
import type InternalZigbeeDevice from "../model/device";

export abstract class ZigbeeDevice extends Device {
  readonly ieeeAddr: string;

  constructor(internalDevice: InternalZigbeeDevice, definition: Definition) {
    super({
      integration: "zigbee",
      id: internalDevice.ID,
      name: internalDevice.defaultName,
      manufacturer: definition.vendor,
      model: definition.model,
    });
    this.ieeeAddr = internalDevice.ieeeAddr;
  }
}
