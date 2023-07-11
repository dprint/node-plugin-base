import fs from "node:fs";
import crypto from "node:crypto";

export interface CreatePluginFileOptions {
  /** Ex. dprint-plugin-prettier */
  name: string;
  /** Ex. 1.0.0 */
  version: string;
  /** Ex. https://github.com/<org>/<repo>/releases/download/<version>/<zip_file_name> */
  zipUrl: string;
  /** A file path to the zip file, which will be used to get a checksum. */
  zipPath: string;
}

export function createPluginFile(options: CreatePluginFileOptions) {
  return {
    schemaVersion: 2,
    kind: "node",
    name: options.name,
    version: options.version,
    archive: {
      reference: options.zipUrl,
      checksum: getChecksum(fs.readFileSync(options.zipPath)),
    }
  };
}

/** Gets the sha256 checksum of the provided bytes. */
function getChecksum(bytes: Uint8Array) {
  const hash = crypto.createHash("sha256");
  hash.update(bytes);
  return hash.digest("hex");
}
