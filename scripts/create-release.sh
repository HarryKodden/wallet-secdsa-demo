#!/usr/bin/env bash
# Create a GitHub release (tag + release notes). CI builds GHCR images tagged
# with the release (e.g. v0.1.0) plus :latest on the default branch / release.
#
# Usage:
#   ./scripts/create-release.sh           # suggest next tag, confirm or edit
#   ./scripts/create-release.sh v0.2.0    # use this tag (still confirms)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repository." >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI required (https://cli.github.com/). Authenticate with: gh auth login" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes first." >&2
  git status -sb >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
default_branch="$(git remote show origin 2>/dev/null | sed -n '/HEAD branch/s/.*: //p' || true)"
default_branch="${default_branch:-main}"
if [[ "$branch" != "$default_branch" ]]; then
  echo "Warning: you are on '$branch' (default is '$default_branch')." >&2
  read -r -p "Continue releasing from this branch? [y/N] " ans
  case "${ans:-}" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

git fetch --tags --quiet origin 2>/dev/null || true

latest="$(git tag -l 'v*' --sort=-v:refname | head -1 || true)"
if [[ -z "$latest" ]]; then
  suggested="v0.1.0"
else
  ver="${latest#v}"
  IFS=. read -r major minor patch <<<"$ver"
  major="${major:-0}"
  minor="${minor:-0}"
  patch="${patch:-0}"
  # strip pre-release / build metadata from patch for numeric bump
  patch="${patch%%[-+]*}"
  if [[ "$major" =~ ^[0-9]+$ && "$minor" =~ ^[0-9]+$ && "$patch" =~ ^[0-9]+$ ]]; then
    suggested="v${major}.${minor}.$((patch + 1))"
  else
    suggested="v0.1.0"
  fi
fi

if [[ $# -ge 1 && -n "${1:-}" ]]; then
  suggested="$1"
  [[ "$suggested" == v* ]] || suggested="v${suggested}"
fi

echo "Latest release tag: ${latest:-"(none)"}"
echo "Suggested next tag: ${suggested}"
read -r -p "Release tag [${suggested}]: " input
tag="${input:-$suggested}"
tag="${tag#"${tag%%[![:space:]]*}"}"
tag="${tag%"${tag##*[![:space:]]}"}"
[[ "$tag" == v* ]] || tag="v${tag}"

if [[ ! "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
  echo "Tag '$tag' does not look like semver (e.g. v1.2.3)." >&2
  read -r -p "Continue anyway? [y/N] " ans
  case "${ans:-}" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

if git rev-parse -q --verify "refs/tags/${tag}" >/dev/null; then
  echo "Tag ${tag} already exists locally." >&2
  exit 1
fi
if git ls-remote --exit-code --tags origin "refs/tags/${tag}" >/dev/null 2>&1; then
  echo "Tag ${tag} already exists on origin." >&2
  exit 1
fi

echo
echo "About to:"
echo "  1. Push branch '${branch}' to origin"
echo "  2. Create annotated tag ${tag} at $(git rev-parse --short HEAD)"
echo "  3. Push tag and create GitHub release ${tag}"
echo "  4. CI will publish:"
echo "       ghcr.io/harrykodden/wallet-secdsa-demo/web-wallet:${tag}"
echo "       ghcr.io/harrykodden/wallet-secdsa-demo/wallet-api2:${tag}"
read -r -p "Proceed? [y/N] " ans
case "${ans:-}" in
  y|Y|yes|YES) ;;
  *) echo "Aborted."; exit 1 ;;
esac

git push -u origin HEAD
git tag -a "$tag" -m "Release ${tag}"
git push origin "$tag"
gh release create "$tag" --title "$tag" --generate-notes

repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
echo
echo "Release ${tag} created: https://github.com/${repo}/releases/tag/${tag}"
echo "Watch CI: https://github.com/${repo}/actions"
echo "Images will be tagged :${tag} (and :latest when built from default branch / this release)."
