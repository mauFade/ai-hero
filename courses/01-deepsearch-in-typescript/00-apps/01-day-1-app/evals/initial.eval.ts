import { evalite } from "evalite";
import { askDeepSearch } from "~/deep-search";
import type { Message } from "ai";

evalite("Deep Search Eval", {
  data: async (): Promise<{ input: Message[] }[]> => {
    return [
      {
        input: [
          {
            id: "1",
            role: "user",
            content: "What is the latest version of TypeScript?",
          },
        ],
      },
      {
        input: [
          {
            id: "2",
            role: "user",
            content: "What are the main features of Next.js 15?",
          },
        ],
      },
      {
        input: [
          {
            id: "3",
            role: "user",
            content: "How do I implement authentication in a React app?",
          },
        ],
      },
      {
        input: [
          {
            id: "4",
            role: "user",
            content: "What are the best practices for API design?",
          },
        ],
      },
      {
        input: [
          {
            id: "5",
            role: "user",
            content: "How to deploy a Node.js application to production?",
          },
        ],
      },
      {
        input: [
          {
            id: "6",
            role: "user",
            content: "What's the difference between REST and GraphQL?",
          },
        ],
      },
      {
        input: [
          {
            id: "7",
            role: "user",
            content: "How to optimize database queries for better performance?",
          },
        ],
      },
      {
        input: [
          {
            id: "8",
            role: "user",
            content: "What are the latest trends in web development?",
          },
        ],
      },
    ];
  },
  task: async (input) => {
    return askDeepSearch(input);
  },
  scorers: [
    {
      name: "Contains Links",
      description: "Checks if the output contains any markdown links.",
      scorer: ({ output }) => {
        // Check for markdown link syntax: [text](url)
        const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
        const containsLinks = markdownLinkRegex.test(output);

        return containsLinks ? 1 : 0;
      },
    },
  ],
});
