import "dotenv/config";
import { deviceManager } from "./iot";
import { logger } from "./observability/logger";

process.on("SIGINT", async () => {
  deviceManager
    .close()
    .catch((error) => {
      logger.error("Failed to close device manager", { error });
    })
    .finally(() => {
      process.exit(0);
    });
});
