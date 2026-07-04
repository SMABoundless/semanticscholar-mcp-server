export interface ExternalIds {
  ArXiv?: string;
  MAG?: string;
  ACL?: string;
  PubMed?: string;
  Medline?: string;
  PubMedCentral?: string;
  DBLP?: string;
  DOI?: string;
  CorpusId?: number;
}

export interface OpenAccessPdf {
  url: string;
  status: string;
}

export interface PublicationVenue {
  id?: string;
  name?: string;
  type?: string;
  alternate_names?: string[];
  issn?: string;
  url?: string;
}

export interface Journal {
  name?: string;
  volume?: string;
  pages?: string;
}

export interface Author {
  authorId: string;
  name?: string;
  affiliations?: string[];
  homepage?: string | null;
  paperCount?: number;
  citationCount?: number;
  hIndex?: number;
  papers?: Paper[];
  url?: string;
}

export interface Paper {
  paperId: string;
  corpusId?: number;
  externalIds?: ExternalIds;
  url?: string;
  title?: string;
  abstract?: string;
  venue?: string;
  publicationVenue?: PublicationVenue | null;
  year?: number | null;
  referenceCount?: number;
  citationCount?: number;
  influentialCitationCount?: number;
  isOpenAccess?: boolean;
  openAccessPdf?: OpenAccessPdf | null;
  fieldsOfStudy?: string[] | null;
  s2FieldsOfStudy?: Array<{ category: string; source: string }>;
  publicationTypes?: string[] | null;
  publicationDate?: string | null;
  journal?: Journal | null;
  citationStyles?: { bibtex?: string };
  authors?: Author[];
  citations?: Paper[];
  references?: Paper[];
}

export interface CitationEdge {
  citingPaper: Paper;
  isInfluential?: boolean;
  contexts?: string[];
  intents?: string[];
}

export interface ReferenceEdge {
  citedPaper: Paper;
  isInfluential?: boolean;
  contexts?: string[];
  intents?: string[];
}

export interface SnippetAnnotation {
  type?: string;
  text?: string;
  attributes?: Record<string, string>;
}

export interface SnippetMatch {
  text: string;
  section?: string;
  snippetKind?: string;
  annotations?: SnippetAnnotation[];
  paper?: Paper;
}

export interface S2PaginatedResponse<T> {
  total?: number;
  offset?: number;
  next?: number;
  data: T[];
}

export interface S2BulkSearchResponse<T> {
  total: number;
  token?: string;
  data: T[];
}

export interface PaperAutocompleteMatch {
  id: string;
  title?: string;
  authorsYear?: string;
  matchedTerms?: string[];
}

export interface PaperAutocompleteResponse {
  matches: PaperAutocompleteMatch[];
}

export interface PaperRecommendationsResponse {
  recommendedPapers: Paper[];
}

export interface SnippetSearchResponse {
  total?: number;
  snippets?: SnippetMatch[];
}
