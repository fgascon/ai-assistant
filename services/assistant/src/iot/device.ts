export enum DeviceType {
  Switch = "SWITCH",
  DimmableSwitch = "DIMMABLE_SWITCH",
}

export abstract class Device {
  public readonly name: string;
  public readonly brand: string;
  public readonly model: string;
  public abstract readonly type: DeviceType;

  constructor(props: { name: string; brand: string; model: string }) {
    this.name = props.name;
    this.brand = props.brand;
    this.model = props.model;
  }
}

export interface SwitchDevice extends Device {
  readonly type: DeviceType.Switch | DeviceType.DimmableSwitch;
  readonly state: boolean;
  turnOn(): Promise<void>;
  turnOff(): Promise<void>;
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
