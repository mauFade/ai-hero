import { generateObject } from "ai";
import { z } from "zod";
import { model } from "~/models";
import type { SystemContext } from "~/system-context";

export interface SearchAction {
  type: "search";
  query: string;
  title: string;
  reasoning: string;
  [key: string]: unknown;
}

export interface AnswerAction {
  type: "answer";
  title: string;
  reasoning: string;
  [key: string]: unknown;
}

export type Action = SearchAction | AnswerAction;

export const actionSchema = z.object({
  title: z
    .string()
    .describe(
      "The title of the action, to be displayed in the UI. Be extremely concise. 'Searching Saka's injury history', 'Checking HMRC industrial action', 'Comparing toaster ovens'",
    ),
  reasoning: z
    .string()
    .describe("The reason you chose this step."),
  type: z
    .enum(["search", "answer"])
    .describe(
      `The type of action to take.
      - 'search': Search the web for more information and automatically scrape and summarize the most relevant URLs.
      - 'answer': Answer the user's question and complete the loop.`,
    ),
  query: z
    .string()
    .describe(
      "The query to search for. Required if type is 'search'.",
    )
    .optional(),
});

export const getNextAction = async (
  context: SystemContext,
  langfuseTraceId: string,
): Promise<Action> => {
  const result = await generateObject({
    model,
    schema: actionSchema,
    system: `
      You are a helpful assistant that can search the web or answer the user's question.

You are a helpful, verbose AI assistant that always provides detailed, comprehensive, and multi-paragraph answers. For any factual, informational, or open-ended question, you must use the search web tool to find and include as much relevant information as possible. Your responses should:

- Always be thorough, providing context, lists, facts, and related details.
- Use the web search tool for every question that could benefit from up-to-date or external information, not just when unsure.
- Always cite your sources with clickable markdown links using the format [text](url).
- Be conversational and helpful, but always back up your claims with properly formatted source links.
- Err on the side of verbosity and completeness. Do not give short or single-sentence answers.

IMPORTANT: When choosing actions, provide clear, concise titles and detailed reasoning for your choices. The title should be extremely brief (e.g., "Searching for latest news", "Analyzing search results"). The reasoning should explain why this step is necessary and what you hope to learn from it.
    `,
    prompt: `

## Available Actions

### search
Use this action to search the web for current information. This action will:
- Search the web for relevant information
- Automatically scrape the most relevant URLs to get complete content
- Summarize the scraped content to extract the most relevant information
- Return both search snippets and summarized content for comprehensive analysis

### answer
Use this action when you have gathered enough information to provide a comprehensive answer to the user's question.

## Conversation History

${context.getConversationHistory()}

## Current Context

Here is the context of what has been done so far:

${context.getSearchHistory()}

Based on this context and conversation history, choose the next action to take. If you have enough information to answer the user's question comprehensively, choose 'answer'. If you need more information, choose 'search'.
    `,
    experimental_telemetry:  {
      isEnabled: true,
      functionId: "get-next-action",
      metadata: {
        langfuseTraceId,
      },
    } ,
  });

  const { type, query, title, reasoning } = result.object;

  // Validate that required fields are present based on action type
  if (type === "search" && !query) {
    throw new Error("Query is required for search action");
  }

  // Return the appropriate action type
  switch (type) {
    case "search":
      return { type: "search", query: query!, title, reasoning };
    case "answer":
      return { type: "answer", title, reasoning };
    default:
      throw new Error(`Unknown action type: ${type}`);
  }
};

export type OurMessageAnnotation = {
  type: "NEW_ACTION";
  action: Action;
};
