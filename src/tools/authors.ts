import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { s2Request, SemanticScholarApiError } from "../client.js";
import {
  GRAPH_API_BASE,
  DEFAULT_AUTHOR_FIELDS,
  DEFAULT_AUTHOR_SEARCH_FIELDS,
  DEFAULT_PAPER_SEARCH_FIELDS,
} from "../constants.js";
import {
  PaginationSchema,
  FieldsSchema,
  ResponseFormatSchema,
  AuthorIdSchema,
} from "../schemas/common.js";
import type { Author, Paper, S2PaginatedResponse } from "../types.js";

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatAuthorDetail(author: Author): string {
  const lines: string[] = [];
  lines.push(`# ${author.name ?? "Unknown Author"}`);
  lines.push(`**Author ID:** \`${author.authorId}\``);

  if (author.affiliations && author.affiliations.length > 0) {
    lines.push(`**Affiliations:** ${author.affiliations.join(", ")}`);
  }
  if (author.homepage) lines.push(`**Homepage:** ${author.homepage}`);

  const stats: string[] = [];
  if (author.hIndex !== undefined) stats.push(`h-index: ${author.hIndex}`);
  if (author.paperCount !== undefined) stats.push(`Papers: ${author.paperCount}`);
  if (author.citationCount !== undefined) stats.push(`Citations: ${author.citationCount}`);
  if (stats.length > 0) lines.push(`**Stats:** ${stats.join(" | ")}`);

  if (author.url) lines.push(`**URL:** ${author.url}`);

  return lines.join("\n");
}

function formatAuthorListItem(author: Author, index: number): string {
  const aff =
    author.affiliations && author.affiliations.length > 0
      ? ` — ${author.affiliations[0]}`
      : "";
  const stats: string[] = [];
  if (author.hIndex !== undefined) stats.push(`h-index: ${author.hIndex}`);
  if (author.paperCount !== undefined) stats.push(`Papers: ${author.paperCount}`);
  if (author.citationCount !== undefined) stats.push(`Citations: ${author.citationCount}`);
  const statsStr = stats.length > 0 ? ` | ${stats.join(" | ")}` : "";
  return (
    `### ${index}. ${author.name ?? "Unknown"}${aff}${statsStr}\n` +
    `   **ID:** \`${author.authorId}\``
  );
}

function formatPaperListItem(paper: Paper, index: number): string {
  const year = paper.year ? ` (${paper.year})` : "";
  const venue = paper.venue ? ` — *${paper.venue}*` : "";
  const citations =
    paper.citationCount !== undefined ? ` | Citations: ${paper.citationCount}` : "";
  const oa = paper.isOpenAccess ? " | Open Access" : "";
  const url = paper.url ? `\n  URL: ${paper.url}` : "";
  return (
    `### ${index}. ${paper.title ?? "Untitled"}${year}\n` +
    `  **Authors:** ${formatAuthors(paper.authors)}${venue}${citations}${oa}${url}\n` +
    `  **ID:** \`${paper.paperId}\``
  );
}

function formatAuthors(authors?: Author[]): string {
  if (!authors || authors.length === 0) return "Unknown";
  const names = authors.map((a) => a.name ?? a.authorId);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} et al.`;
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

export function registerAuthorTools(server: McpServer): void {
  // Tool 10: author_get
  server.tool(
    "author_get",
    "Retrieve full profile for a Semantic Scholar author. " +
      "Returns name, affiliations, homepage, h-index, paper count, and citation count.",
    {
      author_id: AuthorIdSchema,
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_AUTHOR_FIELDS;
        const author = await s2Request<Author>({
          baseUrl: GRAPH_API_BASE,
          path: `/author/${encodeURIComponent(input.author_id)}`,
          params: { fields },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(author, null, 2) }] };
        }

        return { content: [{ type: "text" as const, text: formatAuthorDetail(author) }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 11: author_batch
  server.tool(
    "author_batch",
    "Retrieve profiles for multiple authors in a single request (up to 1000). " +
      "More efficient than calling author_get repeatedly.",
    {
      author_ids: z
        .array(AuthorIdSchema)
        .min(1)
        .max(1000)
        .describe("List of Semantic Scholar Author IDs to retrieve (1-1000)."),
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_AUTHOR_SEARCH_FIELDS;
        const authors = await s2Request<Author[]>({
          baseUrl: GRAPH_API_BASE,
          path: "/author/batch",
          method: "POST",
          params: { fields },
          body: { ids: input.author_ids },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(authors, null, 2) }] };
        }

        const items = authors
          .filter((a): a is Author => a !== null)
          .map((a, i) => formatAuthorListItem(a, i + 1))
          .join("\n\n---\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `## Batch Author Lookup (${authors.length} authors)\n\n${items}`,
            },
          ],
        };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 12: author_search
  server.tool(
    "author_search",
    "Search for authors by name. Returns matching author profiles with h-index, paper count, and affiliation.",
    {
      query: z
        .string()
        .min(1)
        .describe("Author name search query."),
      ...PaginationSchema.shape,
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_AUTHOR_SEARCH_FIELDS;
        const data = await s2Request<S2PaginatedResponse<Author>>({
          baseUrl: GRAPH_API_BASE,
          path: "/author/search",
          params: {
            query: input.query,
            fields,
            offset: input.offset,
            limit: input.limit,
          },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const authors = data.data ?? [];
        const total = data.total ?? 0;
        const offset = data.offset ?? 0;
        const header =
          `## Author Search: "${input.query}"\n` +
          `**Total results:** ${total.toLocaleString()} | ` +
          `**Showing:** ${offset + 1}–${offset + authors.length}\n`;

        if (authors.length === 0) {
          return { content: [{ type: "text" as const, text: `${header}\nNo authors found.` }] };
        }

        const items = authors
          .map((a, i) => formatAuthorListItem(a, offset + i + 1))
          .join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text: `${header}\n${items}` }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 13: author_papers
  server.tool(
    "author_papers",
    "Get all papers published by a specific author, paginated. " +
      "Returns the author's publication list with title, year, venue, and citation counts.",
    {
      author_id: AuthorIdSchema,
      ...PaginationSchema.shape,
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_PAPER_SEARCH_FIELDS;
        const data = await s2Request<S2PaginatedResponse<Paper>>({
          baseUrl: GRAPH_API_BASE,
          path: `/author/${encodeURIComponent(input.author_id)}/papers`,
          params: { fields, offset: input.offset, limit: input.limit },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const papers = data.data ?? [];
        const total = data.total ?? 0;
        const offset = data.offset ?? 0;
        const header =
          `## Papers by Author \`${input.author_id}\`\n` +
          `**Total:** ${total.toLocaleString()} | ` +
          `**Showing:** ${offset + 1}–${offset + papers.length}\n`;

        if (papers.length === 0) {
          return { content: [{ type: "text" as const, text: `${header}\nNo papers found.` }] };
        }

        const items = papers
          .map((p, i) => formatPaperListItem(p, offset + i + 1))
          .join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text: `${header}\n${items}` }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );
}
