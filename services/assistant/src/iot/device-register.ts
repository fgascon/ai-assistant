import * as fs from "node:fs";
import { dirname } from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { logger } from "../observability/logger";
import { isNodeError } from "../utils/error";
import { Device } from "./device";

export type RegisteredDeviceInfo = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  integration: string;
  whitelisted: boolean;
};

async function readYamlFile(path: string): Promise<unknown> {
  try {
    const fileContent = await fs.promises.readFile(path, "utf-8");
    if (!fileContent) {
      return undefined;
    }
    return YAML.parse(fileContent);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function writeYamlFile(path: string, data: unknown): Promise<void> {
  await fs.promises.mkdir(dirname(path), { recursive: true });
  await fs.promises.writeFile(path, YAML.stringify(data));
}

const fileSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    manufacturer: z.string(),
    model: z.string(),
    integration: z.string(),
    whitelisted: z.boolean().optional(),
  }),
);

export class DeviceRegister {
  private _path: string;
  private _devices = new Map<string, Device>();
  private _devicesInfo = new Map<string, RegisteredDeviceInfo>();
  private _inProgressSave: Promise<void> | undefined;
  private _saveAgain = false;

  constructor({ path }: { path: string }) {
    this._path = path;
    this.load().catch((error) => {
      logger.error("Failed to load device register", { error });
    });
  }

  private async load() {
    // Load devices from file
    const content = await readYamlFile(this._path);
    if (!content) {
      return;
    }
    const parsedContent = fileSchema.parse(content);
    for (const parsedDeviceInfo of parsedContent) {
      const deviceInfo: RegisteredDeviceInfo = {
        whitelisted: false,
        ...parsedDeviceInfo,
      };
      const gid = Device.getGid(deviceInfo);
      this._devicesInfo.set(gid, deviceInfo);
      const device = this._devices.get(gid);
      if (device && device.name !== deviceInfo.name) {
        device.name = deviceInfo.name;
        device.isWhitelisted = deviceInfo.whitelisted;
      }
    }
  }

  private async save() {
    const devices = Array.from(this._devicesInfo.values());
    await writeYamlFile(this._path, devices);
  }

  private scheduleSave() {
    if (!this._inProgressSave) {
      this._inProgressSave = this.save()
        .then(() => {
          this._inProgressSave = undefined;
          if (this._saveAgain) {
            this._saveAgain = false;
            this.scheduleSave();
          }
        })
        .catch((error) => {
          this._inProgressSave = undefined;
          logger.error("Failed to save device register", { error });
        });
    } else {
      this._saveAgain = true;
    }
  }

  registerDevice(device: Device) {
    const registeredInfo = this._devicesInfo.get(device.gid);
    if (!registeredInfo) {
      this._devicesInfo.set(device.gid, {
        id: device.id,
        name: device.name,
        manufacturer: device.manufacturer,
        model: device.model,
        integration: device.integration,
        whitelisted: device.isWhitelisted,
      });
      this.scheduleSave();
    } else {
      device.name = registeredInfo.name;
      device.isWhitelisted = registeredInfo.whitelisted;
    }
    this._devices.set(device.gid, device);
  }

  async close() {
    if (this._inProgressSave) {
      await this._inProgressSave;
    }
  }
}
