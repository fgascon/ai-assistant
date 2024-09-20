export enum DeviceType {
  Switch = "SWITCH",
  DimmableSwitch = "DIMMABLE_SWITCH",
  Button = "BUTTON",
}

let nextLLMDeviceId = 1;

export abstract class Device {
  /**
   * Integration that the device is originating from.
   * For example, "zigbee" or "kasa".
   */
  public readonly integration: string;

  /**
   * Integration specific device ID. This is unique for a given integration.
   */
  public readonly id: string;

  /**
   * Volatile ID used by LLM bot to identify the device when sending commands.
   */
  public readonly llmId = nextLLMDeviceId++;

  /**
   * Friendly name of the device.
   */
  public name: string;

  /**
   * Manufacturer of the device.
   */
  public readonly manufacturer: string;

  /**
   * Model name of the device.
   */
  public readonly model: string;

  /**
   * Type of the device. Used to identify how to interact with the device.
   */
  public abstract readonly type: DeviceType;

  public isWhitelisted: boolean;

  constructor(props: {
    id: string;
    name: string;
    manufacturer: string;
    model: string;
    integration: string;
  }) {
    this.id = props.id;
    this.name = props.name;
    this.manufacturer = props.manufacturer;
    this.model = props.model;
    this.integration = props.integration;
    this.isWhitelisted = false;
  }

  /**
   * Global ID of the device. This is unique across all integrations.
   */
  get gid(): string {
    return Device.getGid(this);
  }

  /**
   * Details about the device that are useful for LLM bot.
   */
  get detailsForLLM(): Record<string, string | number | boolean> {
    return {
      id: this.llmId,
      name: this.name,
      type: this.type,
    };
  }

  static getGid({
    integration,
    id,
  }: Pick<Device, "integration" | "id">): string {
    return `${integration}:${id}`;
  }
}

export interface SwitchDevice extends Device {
  readonly type: DeviceType.Switch | DeviceType.DimmableSwitch;
  readonly state: boolean;
  turnOn(): Promise<void>;
  turnOff(): Promise<void>;
  toggle(): Promise<void>;
}

export interface DimmableDevice extends SwitchDevice {
  readonly type: DeviceType.DimmableSwitch;
  readonly brightness: number;
  setBrightness(brightness: number): Promise<void>;
}

export function isSwitchDevice(device: Device): device is SwitchDevice {
  return [DeviceType.Switch, DeviceType.DimmableSwitch].includes(device.type);
}

export function isDimmableDevice(device: Device): device is DimmableDevice {
  return device.type === DeviceType.DimmableSwitch;
}
