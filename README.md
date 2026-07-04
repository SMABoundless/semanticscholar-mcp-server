# Semantic Scholar MCP Server

An MCP (Model Context Protocol) server for the [Semantic Scholar](https://www.semanticscholar.org/) Academic Graph API — 200M+ papers with citation networks, author profiles, and full-text snippet search.

Built with the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and [Zod](https://github.com/colinhacks/zod).

## Tools (16 total)

### Papers (9 tools)
| Tool | Description |
|------|-------------|
| `paper_search` | Search papers by keyword with filtering (year, venue, field, open access, citations, type) |
| `paper_search_bulk` | Bulk search with cursor pagination for large result sets (up to 10M) |
| `paper_match` | Find the single best match for a known paper title |
| `paper_autocomplete` | Autocomplete partial paper titles (up to 10 suggestions) |
| `paper_get` | Get full details for a paper by ID (S2 ID, DOI, ArXiv, PMID, etc.) |
| `paper_batch` | Retrieve up to 500 papers in a single request |
| `paper_citations` | Get papers that cite a given paper (forward citations) |
| `paper_references` | Get a paper's reference list (bibliography) |
| `paper_authors` | Get author details for a specific paper |

### Authors (4 tools)
| Tool | Description |
|------|-------------|
| `author_get` | Get full author profile (h-index, affiliations, stats) |
| `author_batch` | Retrieve up to 1000 author profiles in one request |
| `author_search` | Search for authors by name |
| `author_papers` | Get all papers by a specific author |

### Recommendations (2 tools)
| Tool | Description |
|------|-------------|
| `recommendations_for_paper` | Get ML-powered paper recommendations for a given paper |
| `recommendations_from_lists` | Get recommendations from positive/negative example papers |

### Snippets (1 tool)
| Tool | Description |
|------|-------------|
| `snippet_search` | Search within paper bodies for specific text passages |

## Setup

### 1. Get an API key (optional but recommended)

Get a free key at [semanticscholar.org/product/api](https://www.semanticscholar.org/product/api#api-key-form). Without a key, requests are heavily rate-limited.

### 2. Install and build

```bash
cd semanticscholar-mcp-server
npm install
npm run build
```

### 3. Add to Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "semantic-scholar": {
      "command": "node",
      "args": ["/path/to/semanticscholar-mcp-server/dist/index.js"],
      "env": {
        "SEMANTICSCHOLAR_API_KEY": "your-api-key"
      }
    }
  }
}
```

Or if using Claude Code CLI:

```bash
claude mcp add semantic-scholar \
  node \
  /path/to/semanticscholar-mcp-server/dist/index.js \
  -e SEMANTICSCHOLAR_API_KEY=your-api-key
```

## Features

- **Multiple ID formats**: Accepts S2 Paper IDs, DOIs, ArXiv IDs, PMIDs, PMCIDs, CorpusIds
- **Markdown or JSON output**: Every tool supports `response_format: "json"` for structured data
- **Custom field selection**: Override default fields with the `fields` parameter
- **Built-in rate limiting**: Token bucket limiter prevents API throttling
- **Batch operations**: Retrieve up to 500 papers or 1000 authors in a single call

## Usage examples

- "Search Semantic Scholar for papers on transformer architectures from 2023"
- "Get recommendations for papers similar to this one"
- "Find the citation network for DOI 10.1038/nature14539"
- "Search for text snippets mentioning 'chain of thought prompting'"
- "Look up author profile for researcher 1741101"

## License

MIT
