/** Test-only stand-in for the `cloudflare:workers` runtime module (Node can't load it). */
export class WorkerEntrypoint {
  constructor(public ctx: unknown, public env: unknown) {}
}
