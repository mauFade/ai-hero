import type { StreamTextResult } from "ai";
import { streamText } from "ai";
import { model } from "~/models";
import type { SystemContext } from "~/system-context";

interface AnswerOptions {
  isFinal?: boolean;
}

export const answerQuestion = (
  ctx: SystemContext,
  options: AnswerOptions = {},
  langfuseTraceId: string,
  onFinish?: Parameters<typeof streamText>[0]["onFinish"],
): StreamTextResult<{}, string> => {
  const { isFinal = false } = options;

  const systemPrompt = `You are a helpful, verbose AI assistant that always provides detailed, comprehensive, and multi-paragraph answers. Your responses should:

- Always be thorough, providing context, lists, facts, and related details.
- Always cite your sources with clickable markdown links using the format [text](url).
- Be conversational and helpful, but always back up your claims with properly formatted source links.
- Err on the side of verbosity and completeness. Do not give short or single-sentence answers.
- Always provide as much useful information as possible.

Based on the search results and summarized content above, provide a comprehensive answer to the user's question. Make sure to:

1. Address the question directly and thoroughly
2. Cite sources using markdown links: [text](url)
3. Include relevant details and context
4. Be comprehensive and detailed in your response
5. If information is missing or unclear, acknowledge this but still provide the best answer possible

${isFinal ? "IMPORTANT: You may not have all the information needed to answer the question completely, but you must make your best effort to provide a comprehensive answer based on the information available. Be transparent about any limitations or gaps in the information." : ""}

## Current Date and Time
Today's date is ${new Date().toLocaleString()}. When users ask for "up-to-date" information, "current" information, or "latest" news, use this date to provide context about what "current" means. Always mention the publication dates of sources when discussing time-sensitive information, and explain how recent or current the information is relative to today's date.`;

  const prompt = `
## Conversation History
${ctx.getConversationHistory()}

## Search History
${ctx.getSearchHistory()}

${isFinal ? "Note: This is the final attempt to answer the question. Provide the best possible answer with the information available, even if it's incomplete." : ""}`;

  return streamText({
    model,
    system: systemPrompt,
    prompt,
    onFinish,
    experimental_telemetry:  {
      isEnabled: true,
      functionId: "answer-question",
      metadata: {
        langfuseTraceId,
      },
    },
  });
};
