"use strict"

const fs = require("fs")
const path = require("path")
const https = require("https")

const root = path.resolve(__dirname)
const queryPath = path.join(root, "queries", "mql5", "highlights.scm")
const minimalQueryPath = path.join(
  root,
  "queries",
  "mql5",
  "highlights.base.scm"
)
const constantsPath = path.join(root, "queries", "mql5", "mql5_constants.json")
const functionsPath = path.join(root, "queries", "mql5", "mql5_functions.json")

const fetchText = url =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "tree-sitter-mql5/build-highlights",
        },
      },
      response => {
        if (response.statusCode && response.statusCode >= 400) {
          reject(new Error(`Request failed: ${response.statusCode}`))
          response.resume()
          return
        }
        let data = ""
        response.setEncoding("utf8")
        response.on("data", chunk => {
          data += chunk
        })
        response.on("end", () => resolve(data))
      }
    )
    request.on("error", reject)
  })

const normalizeHtml = text =>
  text.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim()

const stripHtml = text =>
  text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const extractEnumTableLinks = text => {
  const tableMatch = text.match(
    /<table[^>]*class="EnumTable"[^>]*>[\s\S]*?<\/table>/i
  )
  const scope = tableMatch ? tableMatch[0] : text
  const results = []
  const rowRegex = /<tr[^>]*>[\s\S]*?<\/tr>/gi
  let rowMatch
  while ((rowMatch = rowRegex.exec(scope)) !== null) {
    const row = rowMatch[0]
    const firstCellMatch = row.match(/<td[^>]*>[\s\S]*?<\/td>/i)
    if (!firstCellMatch) {
      continue
    }
    const cell = firstCellMatch[0]
    const linkMatch = cell.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/i)
    if (linkMatch) {
      results.push({ href: linkMatch[1], name: linkMatch[2].trim() })
      continue
    }
    const textValue = stripHtml(cell)
    if (textValue) {
      results.push({ href: "", name: textValue })
    }
  }
  return results
}

const extractConstantsFromIndices = text => {
  const results = new Set()
  for (const link of extractEnumTableLinks(text)) {
    if (link.href && !link.href.startsWith("/en/docs/constants/")) {
      continue
    }
    if (!/^[A-Z][A-Z0-9_]+$/.test(link.name)) {
      continue
    }
    results.add(link.name)
  }
  return results
}

const extractFunctionsFromIndices = text => {
  const results = new Set()
  for (const link of extractEnumTableLinks(text)) {
    if (link.href && !link.href.startsWith("/en/docs/")) {
      continue
    }
    if (link.href.startsWith("/en/docs/python_")) {
      continue
    }
    if (
      link.href.endsWith("/function_indices") ||
      link.href.endsWith("/constant_indices")
    ) {
      continue
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(link.name)) {
      continue
    }
    results.add(link.name)
  }
  return results
}

const writeJson = (filePath, values) => {
  const sorted = Array.from(values).sort()
  fs.writeFileSync(filePath, `${JSON.stringify(sorted, null, 2)}\n`)
  return sorted
}

const extraConstants = [
  "INIT_FAILED",
  "INIT_PARAMETERS_INCORRECT",
  "INIT_SUCCEEDED",
]

const buildAnyOfBlock = (patternLines, captureName, names, extraLines = []) => {
  if (!names.length) {
    return ""
  }
  const chunkSize = 12
  const chunks = []
  for (let i = 0; i < names.length; i += chunkSize) {
    const slice = names.slice(i, i + chunkSize)
    chunks.push(slice.map(name => `"${name}"`).join(" "))
  }
  return [
    ...patternLines,
    `  (#any-of? ${captureName}`,
    ...chunks.map(chunk => `    ${chunk}`),
    "  )",
    ...extraLines,
    ")",
  ].join("\n")
}

const replaceBlock = (content, startMarker, endMarker, newBlock) => {
  const start = content.indexOf(startMarker)
  const end = content.indexOf(endMarker)
  if (start === -1 || end === -1 || end < start) {
    const trimmed = content.trimEnd()
    return `${trimmed}\n\n${startMarker}\n${newBlock}\n${endMarker}\n`
  }
  const before = content.slice(0, start + startMarker.length)
  const after = content.slice(end)
  return `${before}\n${newBlock}\n${after}`
}

const main = async () => {
  const constantsText = normalizeHtml(
    await fetchText("https://www.mql5.com/en/docs/constant_indices")
  )
  const functionsText = normalizeHtml(
    await fetchText("https://www.mql5.com/en/docs/function_indices")
  )

  const constants = writeJson(
    constantsPath,
    new Set([...extractConstantsFromIndices(constantsText), ...extraConstants])
  )
  const functions = writeJson(
    functionsPath,
    extractFunctionsFromIndices(functionsText)
  )

  const constantsBlock = buildAnyOfBlock(
    ["((identifier) @constant.builtin"],
    "@constant.builtin",
    constants,
    ['  (#set! "priority" 110)']
  )

  const functionsBlock = buildAnyOfBlock(
    ["(call_expression", "  function: (identifier) @function.builtin"],
    "@function.builtin",
    functions
  )

  let highlights = fs.readFileSync(minimalQueryPath, "utf8")
  highlights = replaceBlock(
    highlights,
    "; BEGIN BUILTIN CONSTANTS",
    "; END BUILTIN CONSTANTS",
    constantsBlock
  )
  highlights = replaceBlock(
    highlights,
    "; BEGIN BUILTIN FUNCTIONS",
    "; END BUILTIN FUNCTIONS",
    functionsBlock
  )
  fs.writeFileSync(queryPath, highlights)

  console.log(
    `build-highlights: constants ${constants.length}, functions ${functions.length}`
  )
}

main().catch(error => {
  console.error(`build-highlights: ${error.message}`)
  process.exitCode = 1
})
