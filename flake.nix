{
  inputs.nixpkgs.url = "github:NixOS/nixpkgs/174eb786fb68e3a13e4e535a3deea479a0c07a6a";

  outputs = { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_26
          jq
        ];
      };
    };
}
