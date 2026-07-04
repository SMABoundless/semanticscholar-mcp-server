import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { s2Request, SemanticScholarApiError } from "../client.js";
import { RECOMMENDATIONS_API_BASE, DEFAULT_RECOMMENDATION_FIELDS } from "../constants.js";
import { FieldsSchema, ResponseFormatSchema, PaperIdSchema } from "../schemas/common.js";
import type { Paper, Author, PaperRecommendationsResponse } from "../types.js";

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

export function registerRecommendationTools(server: McpServer): void {
  // Tool 14: recommendations_for_paper
  server.tool(
    "recommendations_for_paper",
    "Get papers recommended as similar or related to a given paper, " +
      "using Semantic Scholar's machine learning recommendation engine. " +
      "Choose 'recent' pool for latest papers or 'all-cs' for all Computer Science papers.",
    {
      paper_id: PaperIdSchema,
      from: z
        .enum(["recent", "all-cs"])
        .default("recent")
        .describe(
          "Recommendation pool: 'recent' for recently added papers (default), " +
            "'all-cs' for all Computer Science papers.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .default(10)
        .describe("Number of recommendations to return (1-500, default: 10)."),
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_RECOMMENDATION_FIELDS;
        const data = await s2Request<PaperRecommendationsResponse>({
          baseUrl: RECOMMENDATIONS_API_BASE,
          path: `/papers/forpaper/${encodeURIComponent(input.paper_id)}`,
          params: { from: input.from, limit: input.limit, fields },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const papers = data.recommendedPapers ?? [];
        if (papers.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No recommendations found for paper \`${input.paper_id}\`.`,
              },
            ],
          };
        }

        const items = papers.map((p, i) => formatPaperListItem(p, i + 1)).join("\n\n---\n\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                `## Recommendations for \`${input.paper_id}\`\n` +
                `**Pool:** ${input.from} | **Count:** ${papers.length}\n\n${items}`,
            },
          ],
        };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );

  // Tool 15: recommendations_from_lists
  server.tool(
    "recommendations_from_lists",
    "Get paper recommendations based on a list of positive example papers (papers you like) " +
      "and optional negative examples (papers to avoid). " +
      "Useful for discovering papers in a specific research niche or building a reading list.",
    {
      positive_paper_ids: z
        .array(PaperIdSchema)
        .min(1)
        .max(100)
        .describe(
          "List of paper IDs the user finds relevant/interesting (1-100). " +
            "These are used as positive examples for the recommendation engine.",
        ),
      negative_paper_ids: z
        .array(PaperIdSchema)
        .max(100)
        .default([])
        .describe(
          "Optional list of paper IDs to steer away from (0-100). " +
            "These are used as negative examples.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .default(10)
        .describe("Number of recommendations to return (1-500, default: 10)."),
      fields: FieldsSchema,
      response_format: ResponseFormatSchema,
    },
    async (input) => {
      try {
        const fields = input.fields ?? DEFAULT_RECOMMENDATION_FIELDS;
        const data = await s2Request<PaperRecommendationsResponse>({
          baseUrl: RECOMMENDATIONS_API_BASE,
          path: "/papers/",
          method: "POST",
          params: { limit: input.limit, fields },
          body: {
            positivePaperIds: input.positive_paper_ids,
            negativePaperIds: input.negative_paper_ids,
          },
        });

        if (input.response_format === "json") {
          return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
        }

        const papers = data.recommendedPapers ?? [];
        if (papers.length === 0) {
          return {
            content: [{ type: "text" as const, text: "No recommendations found for the given input papers." }],
          };
        }

        const items = papers.map((p, i) => formatPaperListItem(p, i + 1)).join("\n\n---\n\n");
        return {
          content: [
            {
              type: "text" as const,
              text:
                `## Paper Recommendations from Lists\n` +
                `**Positive examples:** ${input.positive_paper_ids.length} papers | ` +
                `**Negative examples:** ${input.negative_paper_ids.length} papers | ` +
                `**Results:** ${papers.length}\n\n${items}`,
            },
          ],
        };
      } catch (err) {
        return errorResponse(err);
      }
    },
  );
}
