export const GRAPH_API_BASE = "https://api.semanticscholar.org/graph/v1";
export const RECOMMENDATIONS_API_BASE =
  "https://api.semanticscholar.org/recommendations/v1";

export const RATE_LIMIT_MS = 1000; // 1 request per second with API key

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const BATCH_MAX_PAPERS = 500;
export const BATCH_MAX_AUTHORS = 1000;

// Default field sets — tiered by context
// Narrow: for list/search results (concise output)
export const DEFAULT_PAPER_SEARCH_FIELDS =
  "paperId,title,authors,year,citationCount,isOpenAccess,fieldsOfStudy,url,venue";

// Full: for single-entity retrieval
export const DEFAULT_PAPER_FIELDS =
  "paperId,title,abstract,authors,year,citationCount,referenceCount," +
  "influentialCitationCount,isOpenAccess,openAccessPdf,fieldsOfStudy," +
  "externalIds,url,venue,publicationVenue,publicationTypes,publicationDate,journal";

export const DEFAULT_AUTHOR_SEARCH_FIELDS =
  "authorId,name,affiliations,paperCount,citationCount,hIndex";

export const DEFAULT_AUTHOR_FIELDS =
  "authorId,name,affiliations,homepage,paperCount,citationCount,hIndex";

export const DEFAULT_CITATION_FIELDS =
  "paperId,title,authors,year,citationCount,isOpenAccess,url,venue";

export const DEFAULT_RECOMMENDATION_FIELDS =
  "paperId,title,authors,year,citationCount,isOpenAccess,fieldsOfStudy,url,venue";

export const DEFAULT_SNIPPET_FIELDS =
  "paperId,title,year,authors,url";
