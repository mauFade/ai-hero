import type { StreamTextResult } from "ai";
import { SystemContext, type QueryResult, type ScrapeResult } from "./system-context";
import { getNextAction } from "~/get-next-action";
import { searchSerper } from "~/serper";
import { bulkCrawlWebsites } from "~/server/scraper";
import { answerQuestion } from "./answer-question";

// Copy of the search function from deep-search.ts
const searchWeb = async (query: string): Promise<QueryResult> => {
  const results = await searchSerper(
    { q: query, num: 10 },
    undefined, // no abort signal for this implementation
  );

  return {
    query,
    results: results.organic.map((result) => ({
      title: result.title,
      url: result.link,
      snippet: result.snippet,
      date: result.date || "Unknown date",
    })),
  };
};

// Copy of the scrape function from deep-search.ts
const scrapeUrl = async (urls: string[]): Promise<ScrapeResult[]> => {
  const result = await bulkCrawlWebsites({ urls });

  if (!result.success) {
    // Return successful scrapes even if some failed
    return result.results
      .filter((r) => r.result.success)
      .map((r) => ({
        url: r.url,
        result: (r.result as any).data,
      }));
  }

  return result.results
    .filter((r) => r.result.success)
    .map((r) => ({
      url: r.url,
      result: r.result.data,
    }));
};

export const runAgentLoop = async (userQuestion: string): Promise<StreamTextResult<{}, string>> => {
  // A persistent container for the state of our system
  const ctx = new SystemContext(userQuestion);

  // A loop that continues until we have an answer
  // or we've taken 10 actions
  while (!ctx.shouldStop()) {
    // We choose the next action based on the state of our system
    const nextAction = await getNextAction(ctx);

    // We execute the action and update the state of our system
    if (nextAction.type === "search") {
      const result = await searchWeb(nextAction.query);
      ctx.reportQueries([result]);
    } else if (nextAction.type === "scrape") {
      const results = await scrapeUrl(nextAction.urls);
      ctx.reportScrapes(results);
    } else if (nextAction.type === "answer") {
      return answerQuestion(ctx);
    }

    // We increment the step counter
    ctx.incrementStep();
  }

  // If we've taken 10 actions and still don't have an answer,
  // we ask the LLM to give its best attempt at an answer
  return answerQuestion(ctx, { isFinal: true });
};
