import { z } from "zod";
import { DEFAULT_LIMIT, MAX_LIMIT } from "../constants.js";

export const PaginationSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIMIT)
    .default(DEFAULT_LIMIT)
    .describe(`Number of results to return (1-${MAX_LIMIT}, default: ${DEFAULT_LIMIT})`),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Offset for pagination (default: 0)"),
});

export const FieldsSchema = z
  .string()
  .optional()
  .describe(
    "Comma-separated fields to return, overriding defaults. " +
      "Paper fields: paperId, title, abstract, authors, year, citationCount, referenceCount, " +
      "influentialCitationCount, isOpenAccess, openAccessPdf, fieldsOfStudy, externalIds, url, " +
      "venue, publicationVenue, publicationTypes, publicationDate, journal, citations, references. " +
      "Author fields: authorId, name, affiliations, homepage, paperCount, citationCount, hIndex.",
  );

export const ResponseFormatSchema = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe(
    "Output format: 'markdown' for human-readable text (default), 'json' for raw structured data",
  );

export const PaperIdSchema = z
  .string()
  .min(1)
  .describe(
    "Paper identifier. Accepts: bare S2 Paper ID (40-char hash), " +
      "DOI:10.xxxx/xxxx, ARXIV:xxxx.xxxx, PMID:nnnnn, PMCID:PMCnnnnn, " +
      "MAG:nnnnn, ACL:xxx, CorpusId:nnnnn",
  );

export const AuthorIdSchema = z
  .string()
  .min(1)
  .describe("Semantic Scholar Author ID (numeric string, e.g. '1741101')");
