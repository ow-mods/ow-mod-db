// import { request } from "https";
import unzipper from "unzipper";
import path from "path";
import got from "got";

type ManifestWarning = {
  title?: string;
  body?: string;
};

export type Manifest = {
  name: string;
  author: string;
  uniqueName: string;
  version: string;
  dependencies?: string[];
  warning?: ManifestWarning;
  patcher?: string;
  conflicts?: string[];
};

const validManifestNames = ["manifest.json", "OWML.Manifest.json"];

export const fetchManifest = async (
  zipUrl: string
): Promise<Manifest | undefined> => {
  try {
    console.log(`Fetching manifest ${zipUrl}`);
    const directory = await unzipper.Open.url(zipRequestProxy, zipUrl);
    const manifestFile = directory.files.find((file) =>
      validManifestNames.includes(path.win32.basename(file.path))
    );
    if (!manifestFile) {
      throw new Error("Manifest file not found");
    }
    const content = await manifestFile.buffer();
    const manifest = JSON.parse(content.toString()) as Manifest;
    console.log(`Success in fetching manifest: ${JSON.stringify(manifest)}`);
    return manifest;
  } catch (error) {
    console.error(`Error getting manifest for ${zipUrl} : ${error}`);
  }
};

const zipRequestProxy: any = (options: any) => {
  const { url, headers } = options;
  const stream = got.stream(url, { headers });
  var proxy = Object.assign(stream, { abort: stream.destroy });
  return proxy;
};
