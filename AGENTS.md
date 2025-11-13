Always use context7 when I need code generation, setup or configuration steps, or library/API documentation. This means you should automatically use the Context7 MCP tools to resolve library id and get library docs without me having to explicitly ask.

# General development rules

You are an engineer who writes code for **human brains, not machines**. You favour code that is simple to undertand and maintain. Remember at all times that the code you will be processed by human brain. The brain has a very limited capacity. People can only hold ~4 chunks in their working memory at once. If there are more than four things to think about, it feels mentally taxing for us.

Here's an example that's hard for people to understand:
```
if val > someConstant // (one fact in human memory)
    && (condition2 || condition3) // (three facts in human memory), prev cond should be true, one of c2 or c3 has be true
    && (condition4 && !condition5) { // (human memory overload), we are messed up by this point
    ...
}
```

A good example, introducing intermediate variables with meaningful names:
```
isValid = val > someConstant
isAllowed = condition2 || condition3
isSecure = condition4 && !condition5 
// (human working memory is clean), we don't need to remember the conditions, there are descriptive variables
if isValid && isAllowed && isSecure {
    ...
}
```

- Don't write useless "WHAT" comments, especially the ones that duplicate the line of the following code. "WHAT" comments only allowed if they give a bird's eye overview, a description on a higher level of abstraction that the following block of code. Also, write "WHY" comments, that explain the motivation behind the code (why is it done in that specific way?), explain an especially complex or tricky part of the code.
- Make conditionals readable, extract complex expressions into intermediate variables with meaningful names.
- Prefer early returns over nested ifs, free working memory by letting the reader focus only on the happy path only.
- Prefer composition over deep inheritance, don’t force readers to chase behavior across multiple classes.
- Don't write shallow methods/classes/modules (complex interface, simple functionality). An example of shallow class: `MetricsProviderFactoryFactory`. The names and interfaces of such classes tend to be more mentally taxing than their entire implementations. Having too many shallow modules can make it difficult to understand the project. Not only do we have to keep in mind each module responsibilities, but also all their interactions.
- Prefer deep method/classes/modules (simple interface, complex functionality) over many shallow ones. 
- Don't overuse language featuress, stick to the minimal subset. Readers shouldn't need an in-depth knowledge of the language to understand the code.
- Use self-descriptive values, avoid custom mappings that require memorization.
- Don't abuse DRY, a little duplication is better than unnecessary dependencies.
- Avoid unnecessary layers of abstractions, jumping between layers of abstractions (like many small methods/classes/modules) is mentally exhausting, linear thinking is more natural to humans.

## Build, Test, and Development Commands
This project is front-end only, so a static server is enough for local work. Run `python3 -m http.server 8123` from the repo root to preview the app, or use `npx serve .` if you prefer a Node-based workflow. When adding bundling or transpilation later, expose commands through `package.json` scripts (for example, `npm run dev` or `npm run build`) so other agents inherit the same entry points.