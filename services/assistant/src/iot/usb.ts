import { EventEmitter } from "node:events";
import { usb } from "usb";
import { autoDetect } from "@serialport/bindings-cpp";

type USBDevice = {
  path: string;
  vendorId: string | undefined;
  productId: string | undefined;
};

type USBWatcherEvents = {
  connect: [USBDevice];
  disconnect: [];
  error: [Error];
};

export class USBWatcher extends EventEmitter<USBWatcherEvents> {
  private vid: string;
  private pid: string;
  private currentPath: string | undefined;

  constructor(options: { vid: string; pid: string }) {
    super();
    this.vid = options.vid;
    this.pid = options.pid;

    this.handleChange().catch(this.handleError);
    usb.on("attach", () => this.handleChange().catch(this.handleError));
    usb.on("detach", () => this.handleChange().catch(this.handleError));
  }

  private handleError(error: unknown) {
    this.emit(
      "error",
      error instanceof Error ? error : new Error("USB error: " + String(error)),
    );
  }

  private async handleChange() {
    const devices: USBDevice[] = await autoDetect().list();
    const device = devices.find(
      (device) => device.productId === this.pid && device.vendorId === this.vid,
    );
    if (device && device.path === this.currentPath) {
      return;
    }
    if (this.currentPath && (!device || device.path !== this.currentPath)) {
      this.emit("disconnect");
      this.currentPath = undefined;
    }
    if (device) {
      this.emit("connect", device);
      this.currentPath = device.path;
    }
  }
}
