import "server-only";
import type { FetchParams, FetchResponse, SearchParams, SearchResponse } from "../client";

/**
 * Fixtures for TINYFISH_MOCK=1: no network, no credits. Every title starts with "[mock]" so fixture data can never
 * be mistaken for real web data. Services that run agents pass their own `mockResult` to `runAgent()`.
 */

export function mockSearch(params: SearchParams): SearchResponse {
  const domain = params.include_domains?.[0] ?? "example.org";
  const slug = params.query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "result";
  const results = [1, 2, 3].map((position) => ({
    position,
    site_name: domain,
    title: `[mock] ${params.query} (${position})`,
    snippet: `[mock] Search result ${position} for "${params.query}".`,
    url: `https://${domain}/${slug}-${position}`,
  }));
  return { query: params.query, results, total_results: results.length, page: 0 };
}

export function mockFetch(params: FetchParams): FetchResponse {
  return {
    results: params.urls.map((url) => ({
      url,
      final_url: url,
      title: `[mock] ${url}`,
      description: null,
      language: "en",
      text: `# [mock] Page\n\nFixture text for ${url}. No real content was fetched.`,
      ...(params.highlights ? { highlights: [{ text: `[mock] passage about ${params.highlights.query}`, rank: 1 }] } : {}),
      latency_ms: 0,
      format: params.format ?? "markdown",
    })),
    errors: [],
  };
}
