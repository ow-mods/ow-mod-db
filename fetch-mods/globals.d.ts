type ModInfo = {
  repo: string;
  manifest: string;
}

type Manifest = {
  name: string;
  author: string;
  uniqueName: string;
  version: string;
};

type Release = {
  downloadUrl: string;
  downloadCount: number;
}

interface Mod extends Release {
  manifest: Manifest;
}
