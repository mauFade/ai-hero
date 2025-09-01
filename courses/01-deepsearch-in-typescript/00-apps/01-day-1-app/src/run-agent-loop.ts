import type { StreamTextResult, Message } from "ai";
import { streamText } from "ai";
import { SystemContext, type SearchHistoryEntry } from "./system-context";
import { getNextAction, type OurMessageAnnotation } from "~/get-next-action";
import { searchSerper } from "~/serper";
import { bulkCrawlWebsites } from "~/server/scraper";
import { answerQuestion } from "./answer-question";
import { summarizeURL } from "~/summarize-url";

// Combined search, scrape, and summarize function
const searchAndScrape = async (
  query: string,
  conversationHistory: string,
  langfuseTraceId: string,
): Promise<SearchHistoryEntry> => {
  // Search for information with reduced results (3 instead of 10)
  const results = await searchSerper(
    { q: query, num: 3 },
    undefined, // no abort signal for this implementation
  );

  // Extract URLs from search results
  const urls = results.organic.map((result) => result.link);

  // Scrape the URLs
  const scrapeResult = await bulkCrawlWebsites({ urls });

  // Combine search results with scraped content and summarize in parallel
  const combinedResults = await Promise.all(
    results.organic.map(async (result, index) => {
      const scrapedContent = scrapeResult.results[index]?.result.success 
        ? (scrapeResult.results[index].result as any).data 
        : "Failed to scrape content";

      // Summarize the content
      const summary = await summarizeURL({
        conversationHistory,
        scrapedContent,
        searchMetadata: {
          date: result.date || "Unknown date",
          title: result.title,
          url: result.link,
        },
        query,
        langfuseTraceId,
      });

      return {
        date: result.date || "Unknown date",
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        scrapedContent,
        summary,
      };
    }),
  );

  return {
    query,
    results: combinedResults,
  };
};

export const runAgentLoop = async (
  conversationHistory: Message[],
  opts: {
    langfuseTraceId: string;
    onFinish: Parameters<typeof streamText>[0]["onFinish"];
  },
): Promise<StreamTextResult<{}, string>> => {
  // A persistent container for the state of our system
  const ctx = new SystemContext(conversationHistory);

  // A loop that continues until we have an answer
  // or we've taken 10 actions
  while (!ctx.shouldStop()) {
    // We choose the next action based on the state of our system
    const nextAction = await getNextAction(ctx, opts.langfuseTraceId);

    // We execute the action and update the state of our system
    if (nextAction.type === "search") {
      const result = await searchAndScrape(nextAction.query, ctx.getConversationHistory(), opts.langfuseTraceId);
      ctx.reportSearch(result);
    } else if (nextAction.type === "answer") {
      return answerQuestion(ctx, {}, opts.langfuseTraceId, opts.onFinish);
    }

    // We increment the step counter
    ctx.incrementStep();
  }

  // If we've taken 10 actions and still don't have an answer,
  // we ask the LLM to give its best attempt at an answer
  return answerQuestion(ctx, { isFinal: true }, opts.langfuseTraceId, opts.onFinish);
};
