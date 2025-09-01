import { generateObject } from "ai";
import { z } from "zod";
import { model } from "~/models";
import type { SystemContext } from "~/system-context";

export interface SearchAction {
  type: "search";
  query: string;
}

export interface ScrapeAction {
  type: "scrape";
  urls: string[];
}

export interface AnswerAction {
  type: "answer";
}

export type Action = SearchAction | ScrapeAction | AnswerAction;

export const actionSchema = z.object({
  type: z
    .enum(["search", "scrape", "answer"])
    .describe(
      `The type of action to take.
      - 'search': Search the web for more information.
      - 'scrape': Scrape a URL.
      - 'answer': Answer the user's question and complete the loop.`,
    ),
  query: z
    .string()
    .describe(
      "The query to search for. Required if type is 'search'.",
    )
    .optional(),
  urls: z
    .array(z.string())
    .describe(
      "The URLs to scrape. Required if type is 'scrape'.",
    )
    .optional(),
});

export const getNextAction = async (
  context: SystemContext,
): Promise<Action> => {
  const result = await generateObject({
    model,
    schema: actionSchema,
    system: `
      You are a helpful assistant that can search the web, scrape a URL, or answer the user's question.

You are a helpful, verbose AI assistant that always provides detailed, comprehensive, and multi-paragraph answers. For any factual, informational, or open-ended question, you must use the search web tool to find and include as much relevant information as possible. Your responses should:

- Always be thorough, providing context, lists, facts, and related details.
- Use the web search tool for every question that could benefit from up-to-date or external information, not just when unsure.
- Always cite your sources with clickable markdown links using the format [text](url).
- Be conversational and helpful, but always back up your claims with properly formatted source links.
- Err on the side of verbosity and completeness. Do not give short or single-sentence answers.
    `,
    prompt: `

## Available Actions

### search
Use this action to search the web for current information. This returns search snippets that provide a quick overview of relevant content, including publication dates when available.

### scrape
Use this action when you need to extract the full text content from specific web pages. This is particularly useful when:
- You need detailed information from specific articles or pages
- The search snippets don't provide enough detail
- You want to analyze the complete content of a webpage
- You need to extract structured information from multiple pages

### answer
Use this action when you have gathered enough information to provide a comprehensive answer to the user's question.

## IMPORTANT: Always Use scrape After search
After using the search action, you MUST ALWAYS use the scrape action to extract the full content from the most relevant URLs found in your search results. Do not rely solely on search snippets - always scrape the actual pages to get complete, detailed information.

## CRITICAL: Scrape Multiple Diverse Sources
When using the scrape action, you MUST ALWAYS scrape 4-6 different websites to ensure comprehensive coverage. Choose a diverse set of sources including:
- Different types of websites (news sites, blogs, official documentation, academic sources, etc.)
- Different perspectives and viewpoints
- Different domains and publishers
- Both recent and authoritative sources

## Current Context

Here is the context of what has been done so far:

${context.getQueryHistory()}

${context.getScrapeHistory()}

Based on this context, choose the next action to take. If you have enough information to answer the user's question comprehensively, choose 'answer'. If you need more information, choose 'search' or 'scrape' as appropriate.`,
  });

  const { type, query, urls } = result.object;

  // Validate that required fields are present based on action type
  if (type === "search" && !query) {
    throw new Error("Query is required for search action");
  }

  if (type === "scrape" && (!urls || urls.length === 0)) {
    throw new Error("URLs are required for scrape action");
  }

  // Return the appropriate action type
  switch (type) {
    case "search":
      return { type: "search", query: query! };
    case "scrape":
      return { type: "scrape", urls: urls! };
    case "answer":
      return { type: "answer" };
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
};
