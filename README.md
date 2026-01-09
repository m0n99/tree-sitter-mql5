# tree-sitter-mql5 (Neovim/Tree-sitter fork)

This is a fork of
[mskelton/tree-sitter-mql5](https://github.com/mskelton/tree-sitter-mql5) to
build on modern Tree-sitter.

This grammar is an extension of
[tree-sitter-cpp](https://github.com/tree-sitter/tree-sitter-cpp) to support
mql5 syntax, and it requires the C++ parser for best results.

## Why this fork exists

- Upstream uses a C++ external scanner (`src/scanner.cc`).
- The new Tree-sitter build pipeline only supports external scanners written in
  C.
- This fork replaces the C++ scanner with a C implementation (`src/scanner.c`).

## Neovim setup (via GitHub)

Use this repo directly as the parser source:

```lua
local ok, parsers = pcall(require, "nvim-treesitter.parsers")
if ok then
  parsers.mql5 = {
    install_info = {
      url = "https://github.com/m0n99/tree-sitter-mql5",
      files = { "src/parser.c", "src/scanner.c" },
      branch = "main",
      generate = false,
      queries = "queries/mql5",
    },
    requires = { "cpp" },
    filetype = "mql5",
  }
end

vim.filetype.add({ extension = { mq5 = "mql5" } })

vim.api.nvim_create_autocmd("FileType", {
  callback = function(ev)
    if vim.bo[ev.buf].filetype == "mql5" then
      vim.treesitter.start(ev.buf, "mql5")
    end
  end,
})
```

Then install:

```
:TSInstall mql5
```

## Highlights status

- Core syntax, literals, and keywords are covered by handwritten queries.
- Built-in constants and functions are appended from MQL5 docs (plus a few
  manual additions) via `pnpm run build-highlights`.
- Highlight coverage is still a work in progress; expect gaps for less common
  constructs.

## Notes

- This fork keeps the grammar intact; only the scanner implementation changes.
