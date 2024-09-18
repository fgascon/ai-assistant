import pino from "pino";
import { resolveRootPath } from "../utils/path";

const transport = pino.transport({
  target: "pino/file",
  options: {
    destination: resolveRootPath("logs/assistant.log"),
  },
});
const pinoLogger = pino(
  {
    level: "debug",
  },
  transport,
);

export const logger = {
  debug(message: string, context: Record<string, unknown> = {}) {
    pinoLogger.debug(context, message);
  },
  info(message: string, context: Record<string, unknown> = {}) {
    pinoLogger.info(context, message);
  },
  warn(message: string, context: Record<string, unknown> = {}) {
    pinoLogger.warn(context, message);
  },
  error(message: string, context: Record<string, unknown> = {}) {
    pinoLogger.error(context, message);
  },
};
