import pino from "pino";

let pinoLogger: pino.Logger | undefined;

export function configureLogger(options: {
  level: string;
  destination: string | number;
}) {
  const transport = pino.transport({
    target: "pino/file",
    options: {
      destination: options.destination,
    },
  });
  pinoLogger = pino(
    {
      level: options.level,
    },
    transport,
  );
}

export const logger = {
  debug(message: string, context: Record<string, unknown> = {}) {
    pinoLogger?.debug(context, message);
  },
  info(message: string, context: Record<string, unknown> = {}) {
    pinoLogger?.info(context, message);
  },
  warn(message: string, context: Record<string, unknown> = {}) {
    pinoLogger?.warn(context, message);
  },
  error(message: string, context: Record<string, unknown> = {}) {
    pinoLogger?.error(context, message);
  },
};
