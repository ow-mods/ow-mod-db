import { Parser } from "commonmark";
import sharp from "sharp";
import fs, { promises as fsp } from "fs";
import path from "path";

export const thumbnailSize = {
  width: 300,
  height: 100,
} as const;

export const generateModThumbnail = async (
  modUniqueName: string,
  outputDirectory: string,
  readme: string
) => {
  const firstImageUrl = getFirstImageUrl(readme);

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

  const fileOutputDir = "thumbnails";
  const optimizedImagePath = path.join(
    outputDirectory,
    fileOutputDir,
    `${modUniqueName}.webp`
  );

  if (!fs.existsSync(fileOutputDir)) {
    await fsp.mkdir(fileOutputDir, { recursive: true });
  }

  const resizedSharpImage = sharpImage
    .resize({ ...thumbnailSize, fit: "cover" })
    .webp({ smartSubsample: true });

  const resizedImage = await resizedSharpImage.toFile(optimizedImagePath);
};

const getPath = (relativePath: string) =>
  path.join(process.cwd(), relativePath);

export const getFirstImageUrl = (markdown: string): string | null => {
  if (!markdown) return null;

  const parsed = new Parser().parse(markdown);
  const walker = parsed.walker();
  let event;
  while ((event = walker.next())) {
    const node = event.node;
    // TODO ignore SVG?
    if (node.type === "image" && node.destination) {
      return node.destination;
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
