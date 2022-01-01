// TODO avoid repeating type code between modify-mod-list and fetch-mods actions.

type ModInfo = {
  name: string;
  uniqueName: string;
  repo: string;
  required?: boolean;
  utility?: boolean;
  parent?: string;
};
