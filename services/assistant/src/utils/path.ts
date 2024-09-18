import { fileURLToPath } from "url";

const rootUrl = new URL("../../../../", import.meta.url);

export function resolveRootPath(relativePath: string | URL): string {
  return fileURLToPath(new URL(relativePath, rootUrl));
}
