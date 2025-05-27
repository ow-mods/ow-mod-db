import { Parser } from "commonmark";
import sharp from "sharp";
import fs, { promises as fsp } from "fs";
import path from "path";
import fetch from "node-fetch";
import { getReadmeMarkdown } from "./readmes.js";
import { GITHUB_RAW_CONTENT_URL } from "../constants.js";

export const thumbnailSize = {
  width: 450,
  height: 150,
} as const;

type ThumbnailInfo = {
  main?: string;
  openGraph?: string;
};

export async function generateModThumbnail(
  slug: string,
  readmeUrl: string,
  outputDirectory: string
): Promise<ThumbnailInfo> {
  const readme = await getReadmeMarkdown(readmeUrl);

  if (!readme) {
    return {};
  }

  const firstImageUrl = getFirstImageUrl(readme, getRawContentUrl(readmeUrl));

  if (firstImageUrl == null) return {};

  const rawImageFilePath = await downloadImage(firstImageUrl, slug);

  if (rawImageFilePath == null) {
    console.log(`Failed to download image ${firstImageUrl} for ${slug}`);
    return {};
  }

  const fileOutputDir = getPath(path.join(outputDirectory, "thumbnails"));

  if (!fs.existsSync(fileOutputDir)) {
    await fsp.mkdir(fileOutputDir, { recursive: true });
  }

  const sharpImage = sharp(rawImageFilePath, {
    animated: true,
    limitInputPixels: false,
  });

  const metadata = await sharpImage.metadata();

  const mainImageName = `${slug}.webp`;
  writeImageFile(sharpImage, metadata, path.join(fileOutputDir, mainImageName));

  let openGraphImageName;

  if ((metadata.pages ?? 0) > 1) {
    const openGraphSharpImage = sharp(rawImageFilePath, {
      pages: 1,
      limitInputPixels: false,
    });

    openGraphImageName = `${slug}-static.webp`;
    await writeImageFile(
      openGraphSharpImage,
      metadata,
      path.join(fileOutputDir, openGraphImageName)
    );
  }

  return {
    main: mainImageName,
    openGraph: openGraphImageName,
  };
}

const writeImageFile = (
  sharpImage: sharp.Sharp,
  metadata: sharp.Metadata,
  filePath: string
) => {
  if (!metadata.width || !metadata.height) {
    console.error(
      `Failed to write image file "${filePath}". Missing metadata values.`
    );
    return;
  }

  const imageRatio = metadata.width / metadata.height;
  const desiredRatio = thumbnailSize.width / thumbnailSize.height;

  return sharpImage
    .resize({
      ...thumbnailSize,
      // If the image is taller than our desired thumbnail ratio, we crop the top and bottom.
      // If the image is wider than our desired thumbnail ratio, we don't crop, we just resize to fit.
      fit: imageRatio > desiredRatio ? "inside" : "cover",
    })
    .webp({ smartSubsample: true })
    .toFile(filePath);
};

function getPath(relativePath: string) {
  return path.join(process.cwd(), relativePath);
}

export function getRawContentUrl(readmeUrl: string) {
  return readmeUrl.replace(/\/(?!.*\/).+/, "");
}

export function getFirstImageUrl(
  markdown: string,
  baseUrl: string
): string | null {
  if (!markdown) return null;

  const parsed = new Parser().parse(markdown);
  const walker = parsed.walker();
  let event;
  while ((event = walker.next())) {
    const node = event.node;
    if (
      node.type === "image" &&
      node.destination &&
      !node.destination.endsWith(".svg") &&
      !node.destination.startsWith("https://img.shields.io/") &&
      !node.destination.startsWith("http://img.shields.io/")
    ) {
      const imageUrl = node.destination;

      const fullUrl = imageUrl.startsWith("http")
        ? // GitHub allows embedding images that actually point to webpages on github.com, so we have to replace the URLs here
          imageUrl.replace(
            /^https?:\/\/github.com\/(.+)\/(.+)\/blob\/(.+)\//gm,
            `${GITHUB_RAW_CONTENT_URL}/$1/$2/$3/`
          )
        : // For relative URLs we also have to resolve them
          `${baseUrl}/${imageUrl}`;

      return fullUrl;
    }
  }

  return null;
}

export async function downloadImage(
  imageUrl: string,
  fileName: string
): Promise<string | null> {
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
}
