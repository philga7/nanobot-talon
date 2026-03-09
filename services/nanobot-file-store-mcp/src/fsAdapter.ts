import fs from "node:fs/promises";
import path from "node:path";

export interface FsAdapterOptions {
  root: string;
}

export class FsAdapter {
  private readonly root: string;

  constructor(options: FsAdapterOptions) {
    this.root = path.resolve(options.root);
  }

  resolve(relativePath: string): string {
    const full = path.resolve(this.root, relativePath);
    if (!full.startsWith(this.root + path.sep) && full !== this.root) {
      throw new Error(`Resolved path escapes root: ${relativePath}`);
    }
    return full;
  }

  async readFile(relativePath: string): Promise<string> {
    const full = this.resolve(relativePath);
    return fs.readFile(full, "utf8");
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const full = this.resolve(relativePath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const tmp = `${full}.tmp-${Date.now()}`;
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, full);
  }

  async deleteFile(relativePath: string): Promise<void> {
    const full = this.resolve(relativePath);
    await fs.rm(full, { force: true });
  }

  async exists(relativePath: string): Promise<boolean> {
    const full = this.resolve(relativePath);
    try {
      await fs.access(full);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(relativeDir: string): Promise<string[]> {
    const dir = this.resolve(relativeDir);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.isFile()) {
        files.push(path.join(relativeDir, entry.name));
      }
    }
    return files;
  }

  async walkFiles(relativeDir: string): Promise<string[]> {
    const start = this.resolve(relativeDir);
    const results: string[] = [];

    const walk = async (absDir: string, relDir: string) => {
      const entries = await fs.readdir(absDir, { withFileTypes: true });
      for (const entry of entries) {
        const absPath = path.join(absDir, entry.name);
        const relPath = path.join(relDir, entry.name);
        if (entry.isDirectory()) {
          await walk(absPath, relPath);
        } else if (entry.isFile()) {
          results.push(relPath);
        }
      }
    };

    await walk(start, relativeDir);
    return results;
  }
}

