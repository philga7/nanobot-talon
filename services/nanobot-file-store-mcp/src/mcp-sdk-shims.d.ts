declare module "@modelcontextprotocol/sdk/server/mcp.js" {
  import type { Implementation } from "@modelcontextprotocol/sdk/server";

  export class McpServer {
    constructor(info: Implementation, options?: unknown);
    tool(
      name: string,
      description: string,
      schema: unknown,
      handler: (args: any) => Promise<any> | any
    ): void;
    connect(transport: { start(): Promise<void> }): Promise<void>;
  }
}

declare module "@modelcontextprotocol/sdk/server/stdio.js" {
  export class StdioServerTransport {
    constructor();
    start(): Promise<void>;
  }
}

