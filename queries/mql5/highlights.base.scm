; MQL5 highlights (minimal, handwritten)
;
; This file is the minimal base. The build script appends built-in
; constants/functions between the markers below and writes the final
; `queries/mql5/highlights.scm`.

; Identifiers
((identifier) @variable
  (#set! priority 95))

; Parameters
(parameter_declaration
  declarator: (identifier) @variable.parameter)

(parameter_declaration
  declarator: (array_declarator) @variable.parameter)

(parameter_declaration
  declarator: (pointer_declarator) @variable.parameter)

(preproc_params
  (identifier) @variable.parameter)

; Literals
(number_literal) @number
(string_literal) @string
(raw_string_literal) @string
(system_lib_string) @string
(char_literal) @character
(true) @boolean
(false) @boolean

; Comments
(comment) @comment @spell

; Keywords
[
  "if"
  "else"
  "switch"
  "case"
  "default"
  "for"
  "while"
  "do"
  "break"
  "continue"
  "return"
  "try"
  "catch"
  "throw"
  "new"
  "delete"
  "class"
  "struct"
  "enum"
  "public"
  "private"
  "protected"
  "virtual"
  "override"
  "final"
  "using"
  "namespace"
  "typedef"
  "const"
  "static"
  "input"
] @keyword

; Types
(primitive_type) @type.builtin
(sized_type_specifier
  _ @type.builtin
  type: _?)
(type_identifier) @type

((identifier) @type.enum
  (#lua-match? @type.enum "^ENUM_[A-Z0-9_]+$"))

; Functions
(call_expression
  function: (identifier) @function.call)

(call_expression
  function: (field_expression
    field: (field_identifier) @function.call))

(function_declarator
  declarator: (identifier) @function)

; Properties
(field_expression
  field: (field_identifier) @property)

; BEGIN BUILTIN CONSTANTS
; END BUILTIN CONSTANTS

; BEGIN BUILTIN FUNCTIONS
; END BUILTIN FUNCTIONS

; Preprocessor
[
  "#if"
  "#ifdef"
  "#ifndef"
  "#else"
  "#elif"
  "#endif"
  "#elifdef"
  "#elifndef"
  (preproc_directive)
] @keyword.directive

"#define" @keyword.directive.define
"#include" @keyword.import

; Operators
[
  "="
  "-"
  "*"
  "/"
  "+"
  "%"
  "~"
  "|"
  "&"
  "^"
  "<<"
  ">>"
  "->"
  "<"
  "<="
  ">="
  ">"
  "=="
  "!="
  "!"
  "&&"
  "||"
  "-="
  "+="
  "*="
  "/="
  "%="
  "|="
  "&="
  "^="
  ">>="
  "<<="
  "--"
  "++"
] @operator

; Punctuation
[
  ";"
  ":"
  ","
  "."
] @punctuation.delimiter

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket
