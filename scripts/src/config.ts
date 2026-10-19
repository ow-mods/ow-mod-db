export const DATABASE_REPOSITORY = {
  owner: "ow-mods",
  repo: "ow-mod-db",
} as const;

export const GITHUB_RAW_CONTENT_URL = "https://raw.githubusercontent.com";

export const THUMBNAIL_URL_BASE = `https://${DATABASE_REPOSITORY.owner}.github.io/${DATABASE_REPOSITORY.repo}/thumbnails`;

export const RELEASE_EXTENSION = "zip";

export const DATABASE_FILE_NAME = "database.json";

export const DOWNLOAD_HISTORY_DIRECTORY = "download-history";

export const LEGACY_DOWNLOAD_HISTORY_URL =
  "https://ow-mods.github.io/ow-mod-download-history/download-history.json";

export const MOD_MANAGER_REPO_URL = "https://github.com/ow-mods/ow-mod-manager";

export const NOTIFICATIONS_FILE_NAME = "notifications.json";

export const ADD_MOD_LABEL = "add-mod";
