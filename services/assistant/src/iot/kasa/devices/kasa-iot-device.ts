import { z } from "zod";
import { IotTransport } from "../iot-transport";
import { KasaDevice, type KasaDeviceInfo } from "./base-kasa-device";

export abstract class KasaIotDevice extends KasaDevice {
  private transport: IotTransport;

  constructor(info: KasaDeviceInfo) {
    super(info);
    this.transport = new IotTransport({ ip: info.ip, port: info.port });
  }

  protected async rawQuery(query: unknown) {
    return this.transport.query(query);
  }

  protected async queryHelper(service: string, target: string, value: unknown) {
    const response = await this.rawQuery({
      [service]: { [target]: value },
    });
    const result = z
      .object({
        [service]: z.object({
          [target]: z.object({ err_code: z.number() }),
        }),
      })
      .safeParse(response);
    if (!result.success) {
      throw new Error(
        `Failed to parse response from device: ${result.error.message}`,
        { cause: result.error },
      );
    }
    const errorCode = result.data[service]![target]!.err_code;
    if (errorCode !== 0) {
      throw new Error(`Failed to call device. Error code: ${errorCode}`);
    }
  }
}
