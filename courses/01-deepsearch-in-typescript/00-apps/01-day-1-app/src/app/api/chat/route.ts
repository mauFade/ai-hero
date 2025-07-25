import type { Message } from "ai";
import {
  streamText,
  createDataStreamResponse,
  type DataStreamWriter,
} from "ai";
import { z } from "zod";
import { model } from "~/models";
import { auth } from "~/server/auth";
import { searchSerper } from "~/serper";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as {
    messages: Array<Message>;
  };

  return createDataStreamResponse({
    execute: async (dataStream: DataStreamWriter) => {
      const { messages } = body;

      const result = streamText({
        model,
        messages,
        system: `You are a helpful, verbose AI assistant that always provides detailed, comprehensive, and multi-paragraph answers. For any factual, informational, or open-ended question, you must use the search web tool to find and include as much relevant information as possible. Your responses should:

- Always be thorough, providing context, lists, facts, and related details.
- Use the web search tool for every question that could benefit from up-to-date or external information, not just when unsure.
- Always cite your sources with clickable markdown links using the format [text](url). For example, instead of writing "https://example.com", write [Example Website](https://example.com).
- When you find relevant information from search results, make sure to:
  1. Format the source URL as a clickable markdown link
  2. Use descriptive text for the link (not just the URL)
  3. Include the link inline with your response
- If a user asks about something that might be outdated or you're unsure about, search the web to provide accurate, up-to-date information.
- Be conversational and helpful, but always back up your claims with properly formatted source links.
- Err on the side of verbosity and completeness. Do not give short or single-sentence answers. Always provide as much useful information as possible.
`,
        tools: {
          searchWeb: {
            parameters: z.object({
              query: z.string().describe("The query to search the web for"),
            }),
            execute: async ({ query }, { abortSignal }) => {
              const results = await searchSerper(
                { q: query, num: 10 },
                abortSignal,
              );

              return results.organic.map((result) => ({
                title: result.title,
                link: result.link,
                snippet: result.snippet,
              }));
            },
          },
        },
        maxSteps: 10,
      });

      result.mergeIntoDataStream(dataStream);
    },
    onError: (error: unknown) => {
      console.error(error);
      return "Oops, an error occurred!";
    },
  });
}
