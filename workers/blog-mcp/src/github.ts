/** Thin GitHub REST client acting as the signed-in teammate. */

export class GitHubAuthError extends Error {
  /** Tells the MCP layer to answer 401 so Claude re-authenticates. */
  readonly authFailure = true;
  constructor() {
    super("Your GitHub sign-in has expired or was removed. Reconnect the Lidr Blog connector in Claude's settings, then try again.");
  }
}

class GitHubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type FileChange = { path: string; content: string | Uint8Array };

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64Utf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export class GitHub {
  private fetcher: typeof fetch;
  // Workers throw "Illegal invocation" if the global fetch is called as a method
  // of another object (this.fetcher(...)), so always call it through a wrapper.
  constructor(private token: string, fetcher: typeof fetch = fetch) {
    this.fetcher = (input, init) => fetcher(input, init);
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetcher(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "lidr-blog-mcp",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) throw new GitHubAuthError();
    if (!res.ok) throw new GitHubError(res.status, `GitHub ${method} ${path} failed (${res.status})`);
    return (await res.json()) as T;
  }

  async whoAmI(): Promise<{ id: number; login: string }> {
    const u = await this.req<{ id: number; login: string }>("GET", "/user");
    return { id: u.id, login: u.login };
  }

  async canWrite(repo: string): Promise<boolean> {
    try {
      const r = await this.req<{ permissions?: { push?: boolean } }>("GET", `/repos/${repo}`);
      return !!r.permissions?.push;
    } catch (e) {
      if (e instanceof GitHubError) return false;
      throw e;
    }
  }

  async readFile(repo: string, path: string): Promise<string | null> {
    try {
      const r = await this.req<{ content?: string }>("GET", `/repos/${repo}/contents/${path}`);
      return r.content === undefined ? null : fromBase64Utf8(r.content);
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return null;
      throw e;
    }
  }

  async listDir(repo: string, path: string): Promise<string[]> {
    try {
      const r = await this.req<{ name: string; type: string }[]>("GET", `/repos/${repo}/contents/${path}`);
      return Array.isArray(r) ? r.filter((e) => e.type === "file").map((e) => e.name) : [];
    } catch (e) {
      if (e instanceof GitHubError && e.status === 404) return [];
      throw e;
    }
  }

  /** One commit on main containing every file. Retries once if main moved meanwhile. */
  async commit(repo: string, files: FileChange[], message: string): Promise<{ sha: string }> {
    for (let attempt = 1; ; attempt++) {
      let stage = "prepare";
      try {
        const ref = await this.req<{ object: { sha: string } }>("GET", `/repos/${repo}/git/ref/heads/main`);
        const base = ref.object.sha;
        const baseCommit = await this.req<{ tree: { sha: string } }>("GET", `/repos/${repo}/git/commits/${base}`);
        const tree = [];
        for (const f of files) {
          const blob = await this.req<{ sha: string }>(
            "POST",
            `/repos/${repo}/git/blobs`,
            typeof f.content === "string" ? { content: f.content, encoding: "utf-8" } : { content: toBase64(f.content), encoding: "base64" },
          );
          tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
        }
        const newTree = await this.req<{ sha: string }>("POST", `/repos/${repo}/git/trees`, { base_tree: baseCommit.tree.sha, tree });
        const commit = await this.req<{ sha: string }>("POST", `/repos/${repo}/git/commits`, { message, tree: newTree.sha, parents: [base] });
        stage = "update-ref";
        await this.req("PATCH", `/repos/${repo}/git/refs/heads/main`, { sha: commit.sha, force: false });
        return { sha: commit.sha };
      } catch (e) {
        const raced = e instanceof GitHubError && e.status === 422 && stage === "update-ref";
        if (raced && attempt < 2) continue;
        if (raced) throw new Error("The blog changed while saving (someone else published at the same moment). Try publishing again.");
        if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) {
          throw new Error("GitHub refused the save: your account doesn't have permission to publish to the blog. Ask the site owner to invite you to lidr-blog.");
        }
        throw e;
      }
    }
  }
}
