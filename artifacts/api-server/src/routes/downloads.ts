import { Router, Request, Response } from "express";
import { getGithubReleaseRepo } from "../githubReleaseRepo.js";

const router = Router();

/**
 * Stable download redirects — the website links to these, never to a
 * specific version. When a new release ships, these automatically
 * resolve to the latest tag's assets without redeploying the site.
 *
 *   /api/downloads/latest/oneshot  → SentinelOneShot.exe
 *   /api/downloads/latest/setup    → SentinelSetup.msi
 *   /api/downloads/latest/agent    → SentinelAgent.exe
 */

const ASSET_MAP: Record<string, string> = {
  oneshot: "SentinelOneShot.exe",
  setup: "SentinelSetup.msi",
  agent: "SentinelAgent.exe",
};

router.get("/latest/:binary", async (req: Request, res: Response) => {
  const raw = req.params.binary;
  const slug = Array.isArray(raw) ? raw[0] : raw;
  const binary = typeof slug === "string" ? slug.toLowerCase() : undefined;
  const assetName = binary ? ASSET_MAP[binary] : undefined;

  if (!assetName) {
    const label =
      typeof slug === "string" ? slug : Array.isArray(raw) ? raw.join(",") : String(raw ?? "");
    res.status(404).json({
      error: `Unknown binary "${label}". Valid options: ${Object.keys(ASSET_MAP).join(", ")}`,
    });
    return;
  }

  const GITHUB_REPO = getGithubReleaseRepo();

  try {
    // Use the GitHub API to resolve the latest release and find the asset URL.
    // This redirect approach means the site never needs to know the current version.
    const ghResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "SentinelAPI/1.0",
          // Optionally add a GitHub token for higher rate limits:
          // Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        },
      }
    );

    if (!ghResponse.ok) {
      console.error(
        `GitHub API error: ${ghResponse.status} ${ghResponse.statusText}`
      );
      // Fallback: redirect to the releases page
      res.redirect(302, `https://github.com/${GITHUB_REPO}/releases/latest`);
      return;
    }

    const release = (await ghResponse.json()) as {
      tag_name: string;
      assets: Array<{
        name: string;
        browser_download_url: string;
      }>;
    };

    const asset = release.assets.find(
      (a) => a.name.toLowerCase() === assetName.toLowerCase()
    );

    if (asset) {
      // 302 redirect — browser downloads the file directly from GitHub Releases
      res.redirect(302, asset.browser_download_url);
    } else {
      console.error(
        `Asset "${assetName}" not found in release ${release.tag_name}. ` +
          `Available: ${release.assets.map((a) => a.name).join(", ")}`
      );
      res.redirect(302, `https://github.com/${GITHUB_REPO}/releases/latest`);
    }
  } catch (err) {
    console.error("Failed to resolve download URL:", err);
    // Graceful fallback — always give the user *something*
    res.redirect(302, `https://github.com/${GITHUB_REPO}/releases/latest`);
  }
});

/**
 * GET /api/downloads/latest
 * Returns metadata about the latest release (for the website to display
 * version numbers, changelogs, etc. without hardcoding).
 */
router.get("/latest", async (_req: Request, res: Response) => {
  const GITHUB_REPO = getGithubReleaseRepo();

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "SentinelAPI/1.0",
        },
      }
    );

    if (!ghResponse.ok) {
      res.status(502).json({ error: "Could not fetch latest release info" });
      return;
    }

    const release = (await ghResponse.json()) as {
      tag_name: string;
      name: string;
      published_at: string;
      html_url: string;
      assets: Array<{
        name: string;
        size: number;
        browser_download_url: string;
        download_count: number;
      }>;
    };

    res.json({
      version: release.tag_name,
      name: release.name,
      publishedAt: release.published_at,
      releaseUrl: release.html_url,
      assets: release.assets.map((a) => ({
        name: a.name,
        size: a.size,
        downloadUrl: a.browser_download_url,
        downloads: a.download_count,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch release info:", err);
    res.status(502).json({ error: "Could not fetch latest release info" });
  }
});

export default router;
