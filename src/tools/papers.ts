import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { s2Request, SemanticScholarApiError } from "../client.js";
import {
  GRAPH_API_BASE,
  DEFAULT_PAPER_FIELDS,
  DEFAULT_PAPER_SEARCH_FIELDS,
  DEFAULT_CITATION_FIELDS,
} from "../constants.js";
import {
  PaginationSchema,
  FieldsSchema,
  ResponseFormatSchema,
  PaperIdSchema,
} from "../schemas/common.js";
import type {
  Paper,
  CitationEdge,
  ReferenceEdge,
  Author,
  S2PaginatedResponse,
  S2BulkSearchResponse,
  PaperAutocompleteResponse,
} from "../types.js";

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatAuthors(authors?: Author[]): string {
  if (!authors || authors.length === 0) return "Unknown";
  const names = authors.map((a) => a.name ?? a.authorId);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} et al.`;
}

function formatPaperListItem(paper: Paper, index: number): string {
  const year = paper.year ? ` (${paper.year})` : "";
  const venue = paper.venue ? ` — *${paper.venue}*` : "";
  const citations =
    paper.citationCount !== undefined ? ` | Citations: ${paper.citationCount}` : "";
  const oa = paper.isOpenAccess ? " | Open Access" : "";
  const fields =
    paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0
      ? `\n  Fields: ${paper.fieldsOfStudy.join(", ")}`
      : "";
  const url = paper.url ? `\n  URL: ${paper.url}` : "";

  return (
    `### ${index}. ${paper.title ?? "Untitled"}${year}\n` +
    `  **Authors:** ${formatAuthors(paper.authors)}${venue}${citations}${oa}${fields}${url}\n` +
    `  **ID:** \`${paper.paperId}\``
  );
}

function formatPaperDetail(paper: Paper): string {
  const lines: string[] = [];
  lines.push(`# ${paper.title ?? "Untitled"}`);

  if (paper.year) lines.push(`**Year:** ${paper.year}`);
  if (paper.authors && paper.authors.length > 0) {
    lines.push(`**Authors:** ${paper.authors.map((a) => a.name ?? a.authorId).join(", ")}`);
  }
  if (paper.venue) lines.push(`**Venue:** ${paper.venue}`);
  if (paper.publicationVenue?.name && paper.publicationVenue.name !== paper.venue) {
    lines.push(`**Publication Venue:** ${paper.publicationVenue.name}`);
  }
  if (paper.publicationDate) lines.push(`**Publication Date:** ${paper.publicationDate}`);
  if (paper.publicationTypes && paper.publicationTypes.length > 0) {
    lines.push(`**Publication Types:** ${paper.publicationTypes.join(", ")}`);
  }
  if (paper.journal?.name) {
    const vol = paper.journal.volume ? `, vol. ${paper.journal.volume}` : "";
    const pg = paper.journal.pages ? `, pp. ${paper.journal.pages}` : "";
    lines.push(`**Journal:** ${paper.journal.name}${vol}${pg}`);
  }

  const stats: string[] = [];
  if (paper.citationCount !== undefined) stats.push(`Citations: ${paper.citationCount}`);
  if (paper.referenceCount !== undefined) stats.push(`References: ${paper.referenceCount}`);
  if (paper.influentialCitationCount !== undefined)
    stats.push(`Influential Citations: ${paper.influentialCitationCount}`);
  if (stats.length > 0) lines.push(`**Stats:** ${stats.join(" | ")}`);

  if (paper.isOpenAccess !== undefined) {
    const oaText = paper.isOpenAccess ? "Yes" : "No";
    const pdfLink =
      paper.isOpenAccess && paper.openAccessPdf?.url
        ? ` — [PDF](${paper.openAccessPdf.url})`
        : "";
    lines.push(`**Open Access:** ${oaText}${pdfLink}`);
  }

  if (paper.fieldsOfStudy && paper.fieldsOfStudy.length > 0) {
    lines.push(`**Fields of Study:** ${paper.fieldsOfStudy.join(", ")}`);
  }

  if (paper.externalIds) {
    const ids: string[] = [];
    if (paper.externalIds.DOI) ids.push(`DOI: ${paper.externalIds.DOI}`);
    if (paper.externalIds.ArXiv) ids.push(`ArXiv: ${paper.externalIds.ArXiv}`);
    if (paper.externalIds.PubMed) ids.push(`PubMed: ${paper.externalIds.PubMed}`);
    if (paper.externalIds.CorpusId) ids.push(`CorpusId: ${paper.externalIds.CorpusId}`);
    if (ids.length > 0) lines.push(`**External IDs:** ${ids.join(" | ")}`);
  }

  if (paper.url) lines.push(`**URL:** ${paper.url}`);
  lines.push(`**S2 Paper ID:** \`${paper.paperId}\``);

  if (paper.abstract) {
    lines.push("", "## Abstract", paper.abstract);
  }

  return lines.join("\n");
}

function formatCitationEdge(edge: CitationEdge, index: number): string {
  const paper = edge.citingPaper;
  const influential = edge.isInfluential ? " *(Influential)*" : "";
  const contexts =
    edge.contexts && edge.contexts.length > 0
      ? `\n  *Context:* "${edge.contexts[0]}"`
      : "";
  return `${formatPaperListItem(paper, index)}${influential}${contexts}`;
}

function formatReferenceEdge(edge: ReferenceEdge, index: number): string {
  const paper = edge.citedPaper;
  const influential = edge.isInfluential ? " *(Influential)*" : "";
  const contexts =
    edge.contexts && edge.contexts.length > 0
      ? `\n  *Context:* "${edge.contexts[0]}"`
      : "";
  return `${formatPaperListItem(paper, index)}${influential}${contexts}`;
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

export function registerPaperTools(server: McpServer): void {
  // Tool 1: paper_search
  server.tool(
    "paper_search",
    "Search for academic papers by keyword across 200M+ papers in the Semantic Scholar corpus. " +
      "Supports filtering by year range, venue, field of study, open access, citation count, and publication type. " +
      "Results are ranked by relevance.",
    {
      query: z
        .string()
        .min(1)
        .max(500)
        .describe("Search query string. Supports phrases with quotes and boolean operators."),
      year: z
        .string()
        .optional()
        .describe(
          "Year filter. Single year '2023' or range '2020-2023'. Also supports open ranges: '2020-' or '-2023'.",
        ),
      venue: z
        .string()
        .optional()
        .describe(
          "Filter by publication venue name, e.g. 'Nature', 'NeurIPS', 'ICLR'. Comma-separated for multiple.",
        ),
      fieldsOfStudy: z
        .string()
        .optional()
        .describe(
          "Comma-separated fields of study, e.g. 'Computer Science,Medicine'. " +
            "Valid values: Computer Science, Medicine, Physics, Mathematics, Biology, Chemistry, etc.",
        ),
      openAccessPdf: z
        .boolean()
        .optional()
        .describe("If true, only return papers with an open access PDF available."),
      minCitationCount: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Minimum number of citations a paper must have."),
      publicationTypes: z
        .string()
        .optional()
        .describe(
          "Comma-separated publication types: JournalArticle, Conference, Review, Book, BookSection, " +
            "Preprint, LettersAndComments, ClinicalTrial, CaseReport, Editorial, News.",
        ),
      publicationDateOrYear: z
        .string()
        .optional()
        .describe(
          "Filter by publication date. Supports ranges: '2019-03-05:2020-06-15', '2019-03:', ':2020-06'.",
        ),
      ...PaginationSchema.shape,
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_PAPER_SEARCH_FIELDS;
        const data = await s2Request<S2PaginatedResponse<Paper>>({
          baseUrl: GRAPH_API_BASE,
          path: "/paper/search",
          params: {
            query: input.query,
            fields,
            year: input.year,
            venue: input.venue,
            fieldsOfStudy: input.fieldsOfStudy,
            openAccessPdf: input.openAccessPdf,
            minCitationCount: input.minCitationCount,
            publicationTypes: input.publicationTypes,
            publicationDateOrYear: input.publicationDateOrYear,
            offset: input.offset,
            limit: input.limit,
          },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const total = data.total ?? 0;
        const offset = data.offset ?? 0;
        const papers = data.data ?? [];
        const header =
          `## Paper Search: "${input.query}"\n` +
          `**Total results:** ${total.toLocaleString()} | ` +
          `**Showing:** ${offset + 1}–${offset + papers.length}\n`;

        if (papers.length === 0) {
          return { content: [{ type: "text" as const, text: `${header}\nNo results found.` }] };
        }

        const items = papers.map((p, i) => formatPaperListItem(p, offset + i + 1)).join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text: `${header}\n${items}` }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 2: paper_search_bulk
  server.tool(
    "paper_search_bulk",
    "Bulk-search papers with cursor-based pagination for retrieving large result sets (up to 10M results). " +
      "Returns a continuation token to fetch subsequent pages. Use for systematic literature collection.",
    {
      query: z.string().min(1).max(500).describe("Search query string."),
      year: z.string().optional().describe("Year filter, e.g. '2020' or '2018-2023'."),
      venue: z.string().optional().describe("Venue filter, comma-separated."),
      fieldsOfStudy: z.string().optional().describe("Fields of study, comma-separated."),
      openAccessPdf: z.boolean().optional().describe("Only open access papers."),
      minCitationCount: z.number().int().min(0).optional().describe("Minimum citation count."),
      publicationTypes: z.string().optional().describe("Publication types, comma-separated."),
      sort: z
        .enum(["citationCount", "publicationDate", "paperId"])
        .optional()
        .describe(
          "Sort order: 'citationCount' (desc), 'publicationDate' (desc), or 'paperId' (asc). Default: relevance.",
        ),
      token: z
        .string()
        .optional()
        .describe("Continuation token from a previous bulk search response to get next page."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(1000)
        .default(100)
        .describe("Results per page (1-1000, default: 100)."),
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_PAPER_SEARCH_FIELDS;
        const data = await s2Request<S2BulkSearchResponse<Paper>>({
          baseUrl: GRAPH_API_BASE,
          path: "/paper/search/bulk",
          params: {
            query: input.query,
            fields,
            year: input.year,
            venue: input.venue,
            fieldsOfStudy: input.fieldsOfStudy,
            openAccessPdf: input.openAccessPdf,
            minCitationCount: input.minCitationCount,
            publicationTypes: input.publicationTypes,
            sort: input.sort,
            token: input.token,
            limit: input.limit,
          },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const papers = data.data ?? [];
        const continuation = data.token
          ? `\n\n**Continuation token:** \`${data.token}\` (pass as 'token' param for next page)`
          : "\n\n*(No more results)*";

        const header =
          `## Bulk Paper Search: "${input.query}"\n` +
          `**Total matching:** ${data.total.toLocaleString()} | **This page:** ${papers.length} papers\n` +
          continuation;

        if (papers.length === 0) {
          return { content: [{ type: "text" as const, text: `${header}\nNo results found.` }] };
        }

        const items = papers.map((p, i) => formatPaperListItem(p, i + 1)).join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text: `${header}\n\n${items}` }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 3: paper_match
  server.tool(
    "paper_match",
    "Find the single best paper matching a given title string. " +
      "Useful for resolving a known paper title to its Semantic Scholar ID and metadata. " +
      "More precise than keyword search when you know the exact title.",
    {
      query: z.string().min(1).describe("The paper title to match."),
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_PAPER_FIELDS;
        const data = await s2Request<{ matchedPaper: Paper }>({
          baseUrl: GRAPH_API_BASE,
          path: "/paper/search/match",
          params: { query: input.query, fields },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        if (!data.matchedPaper) {
          return {
            content: [{ type: "text" as const, text: `No paper matched title: "${input.query}"` }],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `## Best Match for: "${input.query}"\n\n${formatPaperDetail(data.matchedPaper)}`,
            },
          ],
        };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 4: paper_autocomplete
  server.tool(
    "paper_autocomplete",
    "Autocomplete a partial paper title, returning up to 10 suggestions. " +
      "Use for title disambiguation or quick lookup of papers by partial title.",
    {
      query: z
        .string()
        .min(1)
        .max(100)
        .describe("Partial paper title to autocomplete (max 100 characters)."),
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const data = await s2Request<PaperAutocompleteResponse>({
          baseUrl: GRAPH_API_BASE,
          path: "/paper/autocomplete",
          params: { query: input.query },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const matches = data.matches ?? [];
        if (matches.length === 0) {
          return {
            content: [
              { type: "text" as const, text: `No autocomplete matches for: "${input.query}"` },
            ],
          };
        }

        const items = matches
          .map(
            (m, i) =>
              `${i + 1}. **${m.title ?? "Untitled"}**\n   ID: \`${m.id}\`` +
              (m.authorsYear ? ` | ${m.authorsYear}` : ""),
          )
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `## Autocomplete: "${input.query}"\n\n${items}`,
            },
          ],
        };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 5: paper_get
  server.tool(
    "paper_get",
    "Retrieve full details for a single paper by its identifier. " +
      "Returns title, abstract, authors, venue, year, citation counts, external IDs, open access PDF link, and more.",
    {
      paper_id: PaperIdSchema,
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_PAPER_FIELDS;
        const paper = await s2Request<Paper>({
          baseUrl: GRAPH_API_BASE,
          path: `/paper/${encodeURIComponent(input.paper_id)}`,
          params: { fields },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(paper, null, 2) }] };
        }

        return { content: [{ type: "text" as const, text: formatPaperDetail(paper) }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 6: paper_batch
  server.tool(
    "paper_batch",
    "Retrieve details for multiple papers in a single request (up to 500). " +
      "More efficient than calling paper_get repeatedly. Pass a list of paper IDs in any supported format.",
    {
      paper_ids: z
        .array(PaperIdSchema)
        .min(1)
        .max(500)
        .describe("List of paper IDs to retrieve (1-500). Supports all ID formats."),
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_PAPER_SEARCH_FIELDS;
        const papers = await s2Request<Paper[]>({
          baseUrl: GRAPH_API_BASE,
          path: "/paper/batch",
          method: "POST",
          params: { fields },
          body: { ids: input.paper_ids },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(papers, null, 2) }] };
        }

        const items = papers
          .filter((p): p is Paper => p !== null)
          .map((p, i) => formatPaperListItem(p, i + 1))
          .join("\n\n---\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `## Batch Paper Lookup (${papers.length} papers)\n\n${items}`,
            },
          ],
        };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 7: paper_citations
  server.tool(
    "paper_citations",
    "Get papers that cite a given paper (forward citations / 'cited by'). " +
      "Shows which papers reference this work, with influential citation annotations and citation context snippets.",
    {
      paper_id: PaperIdSchema,
      ...PaginationSchema.shape,
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_CITATION_FIELDS;
        const data = await s2Request<S2PaginatedResponse<CitationEdge>>({
          baseUrl: GRAPH_API_BASE,
          path: `/paper/${encodeURIComponent(input.paper_id)}/citations`,
          params: { fields, offset: input.offset, limit: input.limit },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const edges = data.data ?? [];
        const total = data.total ?? 0;
        const offset = data.offset ?? 0;
        const header =
          `## Citations of \`${input.paper_id}\`\n` +
          `**Total:** ${total.toLocaleString()} | **Showing:** ${offset + 1}–${offset + edges.length}\n`;

        if (edges.length === 0) {
          return { content: [{ type: "text" as const, text: `${header}\nNo citations found.` }] };
        }

        const items = edges
          .map((e, i) => formatCitationEdge(e, offset + i + 1))
          .join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text: `${header}\n${items}` }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 8: paper_references
  server.tool(
    "paper_references",
    "Get papers cited by a given paper (its bibliography / reference list). " +
      "Shows what this paper references, with influential citation annotations.",
    {
      paper_id: PaperIdSchema,
      ...PaginationSchema.shape,
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_CITATION_FIELDS;
        const data = await s2Request<S2PaginatedResponse<ReferenceEdge>>({
          baseUrl: GRAPH_API_BASE,
          path: `/paper/${encodeURIComponent(input.paper_id)}/references`,
          params: { fields, offset: input.offset, limit: input.limit },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const edges = data.data ?? [];
        const total = data.total ?? 0;
        const offset = data.offset ?? 0;
        const header =
          `## References of \`${input.paper_id}\`\n` +
          `**Total:** ${total.toLocaleString()} | **Showing:** ${offset + 1}–${offset + edges.length}\n`;

        if (edges.length === 0) {
          return { content: [{ type: "text" as const, text: `${header}\nNo references found.` }] };
        }

        const items = edges
          .map((e, i) => formatReferenceEdge(e, offset + i + 1))
          .join("\n\n---\n\n");
        return { content: [{ type: "text" as const, text: `${header}\n${items}` }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 9: paper_authors
  server.tool(
    "paper_authors",
    "Get the list of authors for a specific paper with author-level details " +
      "(affiliations, h-index, paper count, citation count).",
    {
      paper_id: PaperIdSchema,
      ...PaginationSchema.shape,
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? "authorId,name,affiliations,paperCount,citationCount,hIndex,url";
        const data = await s2Request<S2PaginatedResponse<Author>>({
          baseUrl: GRAPH_API_BASE,
          path: `/paper/${encodeURIComponent(input.paper_id)}/authors`,
          params: { fields, offset: input.offset, limit: input.limit },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const authors = data.data ?? [];
        const total = data.total ?? 0;
        const header = `## Authors of \`${input.paper_id}\`\n**Total:** ${total}\n`;

        if (authors.length === 0) {
          return { content: [{ type: "text" as const, text: `${header}\nNo authors found.` }] };
        }

        const items = authors
          .map((a, i) => {
            const aff =
              a.affiliations && a.affiliations.length > 0
                ? ` — ${a.affiliations[0]}`
                : "";
            const stats: string[] = [];
            if (a.hIndex !== undefined) stats.push(`h-index: ${a.hIndex}`);
            if (a.paperCount !== undefined) stats.push(`Papers: ${a.paperCount}`);
            if (a.citationCount !== undefined) stats.push(`Citations: ${a.citationCount}`);
            const statsStr = stats.length > 0 ? ` | ${stats.join(" | ")}` : "";
            return `${i + 1}. **${a.name ?? "Unknown"}**${aff}${statsStr}\n   ID: \`${a.authorId}\``;
          })
          .join("\n");

        return { content: [{ type: "text" as const, text: `${header}\n${items}` }] };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );
}
