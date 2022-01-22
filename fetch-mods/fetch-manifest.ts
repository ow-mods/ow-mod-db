// import { request } from "https";
import request from "request";
import unzipper from "unzipper";
const got = require("got");

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

export const fetchManifest = async (zipUrl: string): Promise<Manifest> => {
  try {
    console.log(`Fetching manifest ${zipUrl}`);
    const directory = await unzipper.Open.url(zipRequestProxy, zipUrl);
    const manifestFile = directory.files.find((file) =>
      /(^|\/)manifest\.json/gm.test(file.path)
    );
    if (!manifestFile) {
      throw new Error("Manifest file not found");
    }
    const content = await manifestFile.buffer();
    const manifest = JSON.parse(content.toString()) as Manifest;
    console.log(`Success in fetching manifest: ${JSON.stringify(manifest)}`);
    return manifest;
  } catch (error) {
    throw new Error(`Error getting manifest for ${zipUrl} : ${error}`);
  }
};

const zipRequestProxy: any = (options: any) => {
  const { url, headers } = options;
  const stream = got.stream(url, { headers });
  var proxy = Object.assign(stream, { abort: stream.destroy });
  return proxy;
};
