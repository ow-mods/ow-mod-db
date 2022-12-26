import { Parser } from "commonmark";
import sharp from "sharp";
import fs, { promises as fsp } from "fs";
import path from "path";
import fetch from "node-fetch";

export const thumbnailSize = {
  width: 300,
  height: 100,
} as const;

export const generateModThumbnail = async (
  modUniqueName: string,
  readmeUrl: string,
  outputDirectory: string
) => {
  const readme = await getModReadme(readmeUrl);

  if (!readme) {
    return;
  }

  const firstImageUrl = getFirstImageUrl(readme, getRawContentUrl(readmeUrl));

  if (firstImageUrl == null) return;

  const rawImageFilePath = await downloadImage(firstImageUrl, modUniqueName);

  if (rawImageFilePath == null) {
    console.log(
      `Failed to download image ${firstImageUrl} for mod ${modUniqueName}`
    );
    return;
  }

  const sharpImage = sharp(rawImageFilePath, {
    animated: true,
    limitInputPixels: false,
  });

  const fileOutputDir = getPath(path.join(outputDirectory, "thumbnails"));

  if (!fs.existsSync(fileOutputDir)) {
    await fsp.mkdir(fileOutputDir, { recursive: true });
  }

  const resizedSharpImage = sharpImage
    .resize({ ...thumbnailSize, fit: "cover" })
    .webp({ smartSubsample: true });

  const optimizedImagePath = path.join(fileOutputDir, `${modUniqueName}.webp`);
  const resizedImage = await resizedSharpImage.toFile(optimizedImagePath);
};

export const getModReadme = async (url: string): Promise<string | null> => {
  const response = await fetch(url);
  return response.status === 200 ? response.text() : null;
};

const getPath = (relativePath: string) =>
  path.join(process.cwd(), relativePath);

export const getRawContentUrl = (readmeUrl: string) =>
  readmeUrl.replace(/\/(?!.*\/).+/, "");

export const getFirstImageUrl = (
  markdown: string,
  baseUrl: string
): string | null => {
  if (!markdown) return null;

  const parsed = new Parser().parse(markdown);
  const walker = parsed.walker();
  let event;
  while ((event = walker.next())) {
    const node = event.node;
    // TODO ignore SVG?
    if (node.type === "image" && node.destination) {
      const imageUrl = node.destination;

      const fullUrl = imageUrl.startsWith("http")
        ? // GitHub allows embedding images that actually point to webpages on github.com, so we have to replace the URLs here
          imageUrl.replace(
            /^https?:\/\/github.com\/(.+)\/(.+)\/blob\/(.+)\//gm,
            "https://raw.githubusercontent.com/$1/$2/$3/"
          )
        : // For relative URLs we also have to resolve them
          `${baseUrl}/${imageUrl}`;

      return fullUrl;
    }
  }

  return null;
};

export const downloadImage = async (
  imageUrl: string,
  fileName: string
): Promise<string | null> => {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    return null;
  }

  const temporaryDirectory = "tmp/raw-thumbnails";

  if (!fs.existsSync(temporaryDirectory)) {
    await fsp.mkdir(temporaryDirectory, { recursive: true });
  }

  const relativeImagePath = `${temporaryDirectory}/${fileName}`;
  const fullImagePath = getPath(relativeImagePath);

  const image = await response.arrayBuffer();
  await fsp.writeFile(fullImagePath, Buffer.from(image));

  return fullImagePath;
};
