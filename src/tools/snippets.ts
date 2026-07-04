import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { s2Request, SemanticScholarApiError } from "../client.js";
import { GRAPH_API_BASE, DEFAULT_SNIPPET_FIELDS } from "../constants.js";
import { ResponseFormatSchema } from "../schemas/common.js";
import type { SnippetSearchResponse, SnippetMatch } from "../types.js";

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatSnippet(snippet: SnippetMatch, index: number): string {
  const paper = snippet.paper;
  const paperInfo = paper
    ? `**Paper:** ${paper.title ?? "Unknown"} (${paper.year ?? "n.d."}) — ID: \`${paper.paperId}\`` +
      (paper.url ? `\n  URL: ${paper.url}` : "")
    : "";
  const section = snippet.section ? `**Section:** ${snippet.section}\n` : "";
  const kind = snippet.snippetKind ? ` *(${snippet.snippetKind})*` : "";

  return (
    `### ${index}.${kind}\n` +
    (paperInfo ? `${paperInfo}\n` : "") +
    section +
    `> ${snippet.text}`
  );
}

function errorResponse(err: unknown): { isError: true; content: [{ type: "text"; text: string }] } {
  const message =
    err instanceof SemanticScholarApiError
      ? err.message
      : err instanceof Error
        ? `Error: ${err.message}`
        : "An unknown error occurred";
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

// ─── Tool Registration ────────────────────────────────────────────────────────

export function registerSnippetTools(server: McpServer): void {
  // Tool 16: snippet_search
  server.tool(
    "snippet_search",
    "Search for text snippets from within paper bodies (not just titles and abstracts). " +
      "Returns matching text passages with section labels and the papers they come from. " +
      "Useful for finding papers that discuss specific methods, datasets, or concepts in detail.",
    {
      query: z
        .string()
        .min(1)
        .describe("Text to search for within paper bodies."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .default(10)
        .describe("Number of snippet results to return (1-1000, default: 10)."),
      fields: z
        .string()
        .optional()
        .describe(
          "Comma-separated paper fields to include with each snippet. " +
            "E.g. 'paperId,title,year,authors,url,citationCount'. " +
            "Default includes paperId, title, year, authors, url.",
        ),
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_SNIPPET_FIELDS;
        const data = await s2Request<SnippetSearchResponse>({
          baseUrl: GRAPH_API_BASE,
          path: "/snippet/search",
          params: { query: input.query, limit: input.limit, fields },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const snippets = data.snippets ?? [];
        const total = data.total ?? snippets.length;
        const header =
          `## Snippet Search: "${input.query}"\n` +
          `**Total matches:** ${total.toLocaleString()} | **Showing:** ${snippets.length} snippets\n`;

        if (snippets.length === 0) {
          return { content: [{ type: "text" as const, text: `${header}\nNo snippets found.` }] };
        }

        const items = snippets.map((s, i) => formatSnippet(s, i + 1)).join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text: `${header}\n${items}` }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );
}
