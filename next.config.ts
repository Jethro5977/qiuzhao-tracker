import type { NextConfig } from 'next';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const pagesAssetPrefix =
  process.env.GITHUB_ACTIONS === 'true' &&
  repositoryName &&
  !repositoryName.endsWith('.github.io')
    ? `/${repositoryName}`
    : '';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // Keep the route at `/` so Vinext can prerender the entry HTML. GitHub
  // Pages serves that HTML from the repository subpath; only the generated
  // assets need the repository prefix.
  basePath: '',
  assetPrefix: pagesAssetPrefix,
  trailingSlash: true,
};

export default nextConfig;
