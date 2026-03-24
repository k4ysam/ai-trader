# Lessons Learned

## Vitest Mocking

### vi.mock + vi.hoisted for SDK mocks
When mocking a module that is instantiated at module level (`const client = new Anthropic()`),
two issues arise together:

1. **Arrow functions can't be constructors** — `vi.fn().mockImplementation(() => ...)` fails
   with "is not a constructor" when the code does `new Anthropic()`. Use a regular function:
   ```ts
   vi.fn().mockImplementation(function () { return { ... }; })
   ```

2. **TDZ with vi.mock hoisting** — `vi.mock()` is hoisted above `const mockCreate = vi.fn()`,
   causing "Cannot access 'mockCreate' before initialization". Fix with `vi.hoisted()`:
   ```ts
   const mockCreate = vi.hoisted(() => vi.fn());
   vi.mock("some-sdk", () => ({
     default: vi.fn().mockImplementation(function () {
       return { messages: { create: mockCreate } };
     }),
   }));
   ```

### Fence-stripping regex
`/^```json?\n?|\n?```$/g` does NOT strip plain ` ``` ` fences because `j` is required.
Use `/^```(?:json)?\n?|\n?```$/g` to make the `json` part optional.
