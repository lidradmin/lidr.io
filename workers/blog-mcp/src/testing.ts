/* In-memory stand-in for a Workers KV namespace (tests only). */
/* eslint-disable @typescript-eslint/no-explicit-any -- mirrors KV's overloaded return types */

type Entry = { value: ArrayBuffer; metadata?: unknown; expiresAt?: number };

export class MemoryKV {
  map = new Map<string, Entry>();

  async get(key: string, type?: "text" | "json" | "arrayBuffer" | { type: string }): Promise<any> {
    const e = this.map.get(key);
    if (!e || (e.expiresAt && e.expiresAt < Date.now())) return null;
    const t = typeof type === "object" ? type.type : type ?? "text";
    if (t === "arrayBuffer") return e.value.slice(0);
    const text = new TextDecoder().decode(e.value);
    return t === "json" ? JSON.parse(text) : text;
  }

  async getWithMetadata(key: string, type?: "text" | "json" | "arrayBuffer"): Promise<{ value: any; metadata: unknown }> {
    const value = await this.get(key, type);
    return { value, metadata: value === null ? null : this.map.get(key)?.metadata ?? null };
  }

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView, opts?: { expirationTtl?: number; metadata?: unknown }): Promise<void> {
    const buf =
      typeof value === "string"
        ? new TextEncoder().encode(value).buffer
        : ArrayBuffer.isView(value)
          ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
          : value.slice(0);
    this.map.set(key, { value: buf as ArrayBuffer, metadata: opts?.metadata, expiresAt: opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : undefined });
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async list(opts: { prefix?: string } = {}): Promise<{ keys: { name: string; metadata?: unknown }[]; list_complete: boolean }> {
    const keys = [...this.map.entries()]
      .filter(([k, e]) => k.startsWith(opts.prefix ?? "") && !(e.expiresAt && e.expiresAt < Date.now()))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, e]) => ({ name, metadata: e.metadata }));
    return { keys, list_complete: true };
  }
}
