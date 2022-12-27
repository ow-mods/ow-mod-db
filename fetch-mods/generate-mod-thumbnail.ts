import { Parser } from "commonmark";
import sharp from "sharp";
import fs, { promises as fsp } from "fs";
import path from "path";
import fetch from "node-fetch";

export const thumbnailSize = {
  width: 300,
  height: 100,
} as const;

type ThumbnailInfo = {
  main?: string;
  openGraph?: string;
};

export const generateModThumbnail = async (
  slug: string,
  readmeUrl: string,
  outputDirectory: string
): Promise<ThumbnailInfo> => {
  const readme = await getModReadme(readmeUrl);

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

  const sharpImage = sharp(rawImageFilePath, {
    animated: true,
    limitInputPixels: false,
  });

  const fileOutputDir = getPath(path.join(outputDirectory, "thumbnails"));

  if (!fs.existsSync(fileOutputDir)) {
    await fsp.mkdir(fileOutputDir, { recursive: true });
  }

  const resizedSharpImage = sharpImage.resize({
    ...thumbnailSize,
    fit: "cover",
  });

  const mainImageName = `${slug}.webp`;
  await resizedSharpImage
    .webp({ smartSubsample: true })
    .toFile(path.join(fileOutputDir, mainImageName));

  let openGraphImageName;
  const metadata = await sharpImage.metadata();
  if ((metadata.pages ?? 0) > 1) {
    openGraphImageName = `${slug}.png`;
    await resizedSharpImage
      .png()
      .toFile(path.join(fileOutputDir, openGraphImageName));
  }

  return {
    main: mainImageName,
    openGraph: openGraphImageName,
  };
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
