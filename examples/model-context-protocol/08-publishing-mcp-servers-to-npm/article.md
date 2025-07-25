A huge benefit of MCP's design is that you can very easily distribute MCP servers using freely available tools.

In this example, we're going to take [our simple MCP server](https://www.aihero.dev/mcp-server-from-a-single-typescript-file) and publish it to NPM.

Once we've done that, anyone with [Node](https://nodejs.org/en) installed will immediately be able to run our MCP server via `npx`. We'll be able to push updates to it, and users will get those updates automatically.

We're going to be following recommendations from my previous article on Total TypeScript on [how to create an NPM package](https://www.totaltypescript.com/how-to-create-an-npm-package).

## The Basics

The way users are going to run our MCP server is by using `npx`. This is a tool that comes with Node.js that lets users run any package on NPM.

They'll be running this command:

```bash
npx -y @mattpocockuk/mcp-server-example@latest
```

This will:

1. Download the latest version of our package to a global cache (using the `@latest` tag)
2. Ignore the confirmation message that usually appears when running a package for the first time (using the `-y` flag).
3. Run a file referenced inside that package's `package.json` file

So, it's a way of running a package without having to install it.

It's worth noting that this is not without its dangers. If you're running a package from an untrusted source, you should always check the source code first.

## Setting Up The Server

The server and the transport will sit in a single file called `main.ts`. This is the file that will be executed when the user runs our server.

We're going to add a single line to the top of this file: a shebang.

This is a special line that tells the operating system how to run the file. In this case, we're telling it to run the file using Node.js.

```ts
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "Weather Service",
  version: "1.0.0",
});

server.tool(
  "getWeather",
  {
    city: z.string(),
  },
  async ({ city }) => {
    return {
      content: [
        {
          type: "text",
          text: `The weather in ${city} is sunny!`,
        },
      ],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

## `package.json`

We'll need a `package.json` file to describe our package. Here's what it looks like:

```json
{
  "name": "@mattpocockuk/mcp-server-example",
  "version": "0.0.1",
  "description": "An example of a MCP server",
  "bin": {
    "mcp-server-example": "./dist/main.js"
  },
  "files": ["dist"],
  "type": "module",
  "scripts": {
    "build": "tsc",
    "ci": "npm run build",
    "prepublishOnly": "npm run ci"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.7.0"
  }
}
```

Note that the comments will need to be deleted if you copy/paste this into your own `package.json`.

### `package.json#bin`

The most important part of this file is the `bin` field. This tells `npx` which file to run when executing your MCP server. The details for how this logic works is described [here](https://docs.npmjs.com/cli/v8/commands/npx). The important quote is:

```
If the package has a single entry in its `bin` field in `package.json` [...] then that command will be used.
```

So, having a single entry in the `bin` field, no matter what its name is, means that `npx` will run that file.

The file we're going to run is `./dist/main.js`. This is the file that will be built by TypeScript.

## TypeScript

TypeScript is going to be responsible for turning our `.ts` file into a file that Node can run - a `.js` file.

We'll start by adding a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    /* Base Options: */
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "es2022",
    "allowJs": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    /* Strictness */
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    "module": "NodeNext",
    "outDir": "dist",

    "lib": ["ES2022"]
  }
}
```

This will tell typescript how to build our project. The most important part is the `outDir` field. This tells TypeScript where to put the built files. It means that `main.ts` will turn into `dist/main.js`.

## Publishing Our Package

To publish our package, we'll need to run the following command:

```bash
npm publish --access public
```

This will publish our package to NPM. The `--access public` flag means that anyone can install it.

You may get one of several errors:

- If you haven't logged in, you'll need to run `npm login` first.
- If your package name is already taken, you'll need to change it.

But once you've worked through them, your package will be published!

## Testing It Out

You can test it out by running the following command:

```bash
npx -y @mattpocockuk/mcp-server-example@latest
```

This will run the latest version of your package. You can also run a specific version by changing `@latest` to `@1.0.0` or whatever version you want to run.

Oddly, you won't see anything in the terminal. This is because the server is monitoring stdin for commands.

You can try connecting it to a MCP server like Cursor, and asking it for the weather in your city.

## Conclusion

In this article, we've seen how easy it is to publish an MCP server to NPM. This means that anyone with Node.js installed can run your server with a single command.

This is a really powerful way of distributing your MCP servers to anyone who wants to use them.
