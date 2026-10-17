#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${DOTNET_ROOT:-$HOME/.dotnet}:$PATH"
export DOTNET_CLI_TELEMETRY_OPTOUT=1

cd "$ROOT"
rm -rf artifacts
mkdir -p artifacts/pwa artifacts/api artifacts/windows-win-x64 artifacts/installer

dotnet restore Perfecto.Next.slnx
dotnet build Perfecto.Next.slnx -c Release --no-restore
dotnet test tests/Perfecto.Domain.Tests/Perfecto.Domain.Tests.csproj -c Release --no-build
dotnet publish src/Perfecto.Pwa/Perfecto.Pwa.csproj -c Release --no-build -o artifacts/pwa
dotnet publish src/Perfecto.Api/Perfecto.Api.csproj -c Release --no-build -o artifacts/api
dotnet publish src/Perfecto.Windows/Perfecto.Windows.csproj -c Release -r win-x64 --self-contained true -p:PublishReadyToRun=false -o artifacts/windows-win-x64
command -v makensis >/dev/null || {
  printf 'NSIS est requis pour construire le setup Windows.\n' >&2
  exit 1
}
(cd installer && makensis Perfecto.Setup.nsi)

printf 'Livrables produits dans %s/artifacts\n' "$ROOT"
