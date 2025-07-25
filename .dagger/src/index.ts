// .dagger/src/index.ts
/**
 * Backstage Build Module for Dagger
 *
 * Builds, tests and optionally publishes a hardened Backstage image.
 * Runtime stages are aligned with the official Backstage Dockerfiles.
 */
import {
  dag,
  Container,
  Directory,
  object,
  func,
  Secret,
  CacheSharingMode,
} from "@dagger.io/dagger"

// ---------------------------------------------------------------------------
// Base images
// ---------------------------------------------------------------------------
const NODE_BUILD_IMAGE   = "node:20-bookworm";       // full OS for compilation
const NODE_RUNTIME_IMAGE = "node:20-bookworm-slim";  // slim runtime

// ---------------------------------------------------------------------------
// Shared caches (persist between pipeline runs on the same runner)
// ---------------------------------------------------------------------------
const yarnDevCache  = dag.cacheVolume("yarn-dev-cache");   // dev deps
const yarnProdCache = dag.cacheVolume("yarn-prod-cache");  // prod deps
const aptCache      = dag.cacheVolume("apt-cache");        // /var/cache/apt
const aptLibCache   = dag.cacheVolume("apt-lib-cache");    // /var/lib/apt

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Install system tool‑chain, using APT caches for speed. */
function withSystemDeps(c: Container): Container {
  return c
    .withEnvVariable("DEBIAN_FRONTEND", "noninteractive")
    .withEnvVariable("PYTHON", "/usr/bin/python3")
    .withMountedCache("/var/cache/apt", aptCache,  { sharing: CacheSharingMode.Locked })
    .withMountedCache("/var/lib/apt",  aptLibCache,{ sharing: CacheSharingMode.Locked })
    .withExec([
      "bash", "-c",
      [
        "set -euo pipefail",
        "apt-get update",
        // tools required by official Backstage Dockerfiles
        "apt-get install -y --no-install-recommends " +
          "python3 g++ build-essential libsqlite3-dev",
        "rm -rf /var/lib/apt/lists/*"
      ].join(" && ")
    ]);
}

/** Change ownership of tar-extracted files to the `node` user. 
 * This is needed because tar extractions don't respect the owner parameter. */
function chownToNode(c: Container): Container {
  return c.withExec(["chown", "-R", "node:node", "/app"]);
}

/** Copy root‑level files + skeleton, matching the upstream Dockerfile. */
function stageSkeleton(dst: Container, src: Directory): Container {
  return dst
    .withFile(".yarnrc.yml",  src.file(".yarnrc.yml"), { owner: "node:node" })
    .withDirectory(".yarn",   src.directory(".yarn"), { owner: "node:node" })
    .withFile("backstage.json", src.file("backstage.json"), { owner: "node:node" })
    .withFile("yarn.lock",    src.file("yarn.lock"), { owner: "node:node" })
    .withFile("package.json", src.file("package.json"), { owner: "node:node" })
    .withFile("skeleton.tar.gz",
              src.file("packages/backend/dist/skeleton.tar.gz"), { owner: "node:node" });
}

/** Untar an archive into /app and remove it. */
function untar(c: Container, archive: string): Container {
  return c.withExec(["bash", "-c",
    `tar -xzf ${archive} && rm ${archive}`]);
}

// ---------------------------------------------------------------------------
// Dagger object
// ---------------------------------------------------------------------------

@object()
export class Backstage {

  // -----------------------------------------------------------------------
  // 1. Host‑style compilation (fastest)
  // -----------------------------------------------------------------------
  @func()
  async buildBackend(workspace: Directory): Promise<Directory> {

    const build = await dag.container()
      .from(NODE_BUILD_IMAGE)
      .withWorkdir("/app")
      .withMountedCache("/home/node/.cache/yarn", yarnDevCache)
      .withMountedCache("/app/node_modules",      dag.cacheVolume("node-modules"))
      .withMountedDirectory("/app", workspace)
      .withExec(["yarn", "install", "--immutable"])
      .withExec(["yarn", "tsc"])
      .withExec(["yarn", "build:backend"])
      .sync();

    return build.directory("/app");
  }

  // -----------------------------------------------------------------------
  // 2. Build + push
  // -----------------------------------------------------------------------
  @func()
  async buildAndPush(
    source:        Directory,
    registry:      string,
    imageName:     string,
    tags:          string,
    registryUser:  string,
    registryPass:  Secret,
  ): Promise<string> {

    const compiled = await this.buildBackend(source);

    // normalise and split tags
    const tagList = tags.split(",")
      .map(t => t.trim().replace(/^.*:/, ""))
      .filter(Boolean);

    // --- stage as root ----------------------------------------------------
    let image = dag.container()
      .from(NODE_RUNTIME_IMAGE)
      .withWorkdir("/app");

    image = withSystemDeps(image);
    image = stageSkeleton(image, compiled);
    
    // Extract tars while still root
    image = untar(image, "skeleton.tar.gz");
    
    // Copy bundle and config files with node ownership
    image = image
      .withFile("bundle.tar.gz",
                compiled.file("packages/backend/dist/bundle.tar.gz"), { owner: "node:node" })
      .withFile("app-config.yaml", compiled.file("app-config.yaml"), { owner: "node:node" });
    
    // Copy production config if it exists
    try {
      await compiled.file("app-config.production.yaml").id();
      image = image.withFile("app-config.production.yaml", 
                            compiled.file("app-config.production.yaml"), { owner: "node:node" });
    } catch {
      // Production config is optional
    }
    
    image = untar(image, "bundle.tar.gz");
    
    // Copy examples if they exist (as root)
    if (await compiled.directory("examples").id()) {
      image = image.withDirectory("examples", compiled.directory("examples"), { owner: "node:node" });
    }
    
    // Set ownership of entire /app directory to node user
    image = chownToNode(image);

    // --- continue as unprivileged node -----------------------------------
    image = image
      .withUser("node")
      .withEnvVariable("NODE_ENV", "production")
      .withEnvVariable("NODE_OPTIONS", "--no-node-snapshot")
      .withMountedCache(
        "/home/node/.cache/yarn",
        yarnProdCache,
        { sharing: CacheSharingMode.Locked, owner: "node:node" }
      );

    // Install production dependencies as node user
    image = image.withExec(["bash", "-c",
      "yarn workspaces focus --all --production && yarn cache clean"]);

    // entrypoint identical to upstream
    image = image.withEntrypoint([
      "node", "packages/backend",
      "--config", "app-config.yaml"
    ]);

    // --- push -------------------------------------------------------------
    const repo   = `${registry}/${imageName.toLowerCase()}`;
    let digest   = "";
    for (const t of tagList) {
      digest = await image
        .withRegistryAuth(registry, registryUser, registryPass)
        .publish(`${repo}:${t}`);
    }
    return digest;
  }

  // -----------------------------------------------------------------------
  // 3. Environment-specific build + push
  // -----------------------------------------------------------------------
  @func()
  async buildAndPushEnv(
    source:        Directory,
    environment:   string,
    iframeDomain:  string,
    registry:      string,
    imageName:     string,
    tags:          string,
    registryUser:  string,
    registryPass:  Secret,
    gitCommitSha:  string,
    gitCommitShort: string,
    gitBranch:     string,
    buildTime:     string,
    buildVersion:  string,
    gitCommitMessage: string,
    gitCommitAuthor: string,
    buildNumber:   string,
    gitRepository: string,
  ): Promise<string> {

    const compiled = await this.buildBackend(source);

    // normalise and split tags
    const tagList = tags.split(",")
      .map(t => t.trim().replace(/^.*:/, ""))
      .filter(Boolean);

    // --- stage as root ----------------------------------------------------
    let image = dag.container()
      .from(NODE_RUNTIME_IMAGE)
      .withWorkdir("/app");

    image = withSystemDeps(image);
    image = stageSkeleton(image, compiled);
    
    // Extract tars while still root
    image = untar(image, "skeleton.tar.gz");
    
    // Copy bundle with node ownership
    image = image
      .withFile("bundle.tar.gz",
                compiled.file("packages/backend/dist/bundle.tar.gz"), { owner: "node:node" });
    
    // Process app-config.yaml to inject iframe domain at build time
    const configContent = await compiled.file("app-config.yaml").contents();
    const processedConfig = configContent.replace(/\$\{IFRAME_DOMAIN:-localtest\.me\}/g, iframeDomain);
    
    // Create a new file with the processed config
    const processedConfigFile = dag.directory().withNewFile("app-config.yaml", processedConfig).file("app-config.yaml");
    
    image = image.withFile("app-config.yaml", processedConfigFile, { owner: "node:node" });
    
    image = untar(image, "bundle.tar.gz");
    
    // Copy examples if they exist (as root)
    if (await compiled.directory("examples").id()) {
      image = image.withDirectory("examples", compiled.directory("examples"), { owner: "node:node" });
    }
    
    // Set ownership of entire /app directory to node user
    image = chownToNode(image);

    // --- continue as unprivileged node -----------------------------------
    image = image
      .withUser("node")
      .withEnvVariable("NODE_ENV", "production")
      .withEnvVariable("NODE_OPTIONS", "--no-node-snapshot")
      // Set build-time environment variable for iframe domain
      .withEnvVariable("IFRAME_DOMAIN", iframeDomain)
      // Add build metadata as environment variables
      .withEnvVariable("GIT_COMMIT_SHA", gitCommitSha)
      .withEnvVariable("GIT_COMMIT_SHORT", gitCommitShort)
      .withEnvVariable("GIT_BRANCH", gitBranch)
      .withEnvVariable("BUILD_TIME", buildTime)
      .withEnvVariable("BUILD_VERSION", buildVersion)
      .withEnvVariable("GIT_COMMIT_MESSAGE", gitCommitMessage)
      .withEnvVariable("GIT_COMMIT_AUTHOR", gitCommitAuthor)
      .withEnvVariable("BUILD_NUMBER", buildNumber)
      .withEnvVariable("GIT_REPOSITORY", gitRepository)
      .withEnvVariable("BUILD_ENVIRONMENT", environment)
      .withMountedCache(
        "/home/node/.cache/yarn",
        yarnProdCache,
        { sharing: CacheSharingMode.Locked, owner: "node:node" }
      );

    // Install production dependencies as node user
    image = image.withExec(["bash", "-c",
      "yarn workspaces focus --all --production && yarn cache clean"]);

    // entrypoint identical to upstream
    image = image.withEntrypoint([
      "node", "packages/backend",
      "--config", "app-config.yaml"
    ]);

    // --- push -------------------------------------------------------------
    const repo   = `${registry}/${imageName.toLowerCase()}`;
    let digest   = "";
    for (const t of tagList) {
      digest = await image
        .withRegistryAuth(registry, registryUser, registryPass)
        .publish(`${repo}:${t}`);
    }
    return digest;
  }

  // -----------------------------------------------------------------------
  // 4. Local build (no push)
  // -----------------------------------------------------------------------
  @func()
  async build(source: Directory): Promise<Container> {
    const compiled = await this.buildBackend(source);

    let image = dag.container()
      .from(NODE_RUNTIME_IMAGE)
      .withWorkdir("/app");

    image = withSystemDeps(image);
    image = stageSkeleton(image, compiled);
    
    // Extract tars while still root
    image = untar(image, "skeleton.tar.gz");
    
    // Copy bundle and config files with node ownership
    image = image
      .withFile("bundle.tar.gz",
                compiled.file("packages/backend/dist/bundle.tar.gz"), { owner: "node:node" })
      .withFile("app-config.yaml", compiled.file("app-config.yaml"), { owner: "node:node" });
    
    // Copy production config if it exists
    try {
      await compiled.file("app-config.production.yaml").id();
      image = image.withFile("app-config.production.yaml", 
                            compiled.file("app-config.production.yaml"), { owner: "node:node" });
    } catch {
      // Production config is optional
    }
    
    image = untar(image, "bundle.tar.gz");
    
    // Copy examples if they exist (as root)
    if (await compiled.directory("examples").id()) {
      image = image.withDirectory("examples", compiled.directory("examples"), { owner: "node:node" });
    }
    
    // Set ownership of entire /app directory to node user
    image = chownToNode(image);

    // --- continue as unprivileged node -----------------------------------
    image = image
      .withUser("node")
      .withEnvVariable("NODE_ENV", "production")
      .withEnvVariable("NODE_OPTIONS", "--no-node-snapshot")
      .withMountedCache(
        "/home/node/.cache/yarn",
        yarnProdCache,
        { sharing: CacheSharingMode.Locked, owner: "node:node" }
      );

    // Install production dependencies as node user
    image = image.withExec(["bash", "-c",
      "yarn workspaces focus --all --production && yarn cache clean"]);

    return image.withEntrypoint([
      "node", "packages/backend",
      "--config", "app-config.yaml",
      "--config", "app-config.production.yaml"
    ]);
  }
}
