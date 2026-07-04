#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { registerPaperTools } from "./tools/papers.js";
import { registerAuthorTools } from "./tools/authors.js";
import { registerRecommendationTools } from "./tools/recommendations.js";
import { registerSnippetTools } from "./tools/snippets.js";

const server = new McpServer({
  name: "semanticscholar-mcp-server",
  version: "1.0.0",
});

registerPaperTools(server);
registerAuthorTools(server);
registerRecommendationTools(server);
registerSnippetTools(server);

async function main(): Promise<void> {
  if (!process.env.SEMANTICSCHOLAR_API_KEY) {
    console.error(
      "Warning: SEMANTICSCHOLAR_API_KEY is not set. " +
        "Requests will be rate-limited to the unauthenticated tier. " +
        "Set the environment variable to use your API key for higher rate limits.",
    );
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Semantic Scholar MCP Server running on stdio");
  console.error("16 tools registered: 9 paper, 4 author, 2 recommendation, 1 snippet.");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
