#include <assert.h>
#include <stdlib.h>
#include <string.h>
#include <wctype.h>

#include "tree_sitter/parser.h"

enum TokenType {
  RAW_STRING_DELIMITER,
  RAW_STRING_CONTENT,
};

// The spec limits delimiters to 16 chars, enforce this to bound serialization.
static const unsigned RAW_STRING_DELIMITER_MAX = 16;

typedef struct {
  wchar_t *delimiter;
  size_t delimiter_len;
  size_t delimiter_cap;
} Scanner;

static void scanner_reset(Scanner *scanner) {
  scanner->delimiter_len = 0;
}

static bool scanner_reserve(Scanner *scanner, size_t needed) {
  if (needed <= scanner->delimiter_cap) {
    return true;
  }
  size_t next_cap = scanner->delimiter_cap == 0 ? 16 : scanner->delimiter_cap;
  while (next_cap < needed) {
    next_cap *= 2;
  }
  wchar_t *next = (wchar_t *)realloc(scanner->delimiter, next_cap * sizeof(wchar_t));
  if (!next) {
    return false;
  }
  scanner->delimiter = next;
  scanner->delimiter_cap = next_cap;
  return true;
}

static bool scanner_push(Scanner *scanner, wchar_t ch) {
  if (!scanner_reserve(scanner, scanner->delimiter_len + 1)) {
    return false;
  }
  scanner->delimiter[scanner->delimiter_len++] = ch;
  return true;
}

// Scan a raw string delimiter in R"delimiter(content)delimiter".
static bool scan_raw_string_delimiter(Scanner *scanner, TSLexer *lexer) {
  if (scanner->delimiter_len > 0) {
    // Closing delimiter: must exactly match the opening delimiter.
    for (size_t i = 0; i < scanner->delimiter_len; ++i) {
      if ((wchar_t)lexer->lookahead != scanner->delimiter[i]) {
        return false;
      }
      lexer->advance(lexer, false);
    }
    scanner_reset(scanner);
    return true;
  }

  // Opening delimiter: record the d-char-sequence up to (.
  for (;;) {
    if (scanner->delimiter_len > RAW_STRING_DELIMITER_MAX || lexer->lookahead == 0 ||
        lexer->lookahead == '\\' || iswspace(lexer->lookahead)) {
      return false;
    }
    if (lexer->lookahead == '(') {
      // Rather than create a token for an empty delimiter, we fail and let
      // the grammar fall back to a delimiter-less rule.
      return scanner->delimiter_len > 0;
    }
    if (!scanner_push(scanner, (wchar_t)lexer->lookahead)) {
      return false;
    }
    lexer->advance(lexer, false);
  }
}

// Scan the raw string content in R"delimiter(content)delimiter".
static bool scan_raw_string_content(Scanner *scanner, TSLexer *lexer) {
  int delimiter_index = -1;
  for (;;) {
    if (lexer->lookahead == 0) {
      lexer->mark_end(lexer);
      return true;
    }

    if (delimiter_index >= 0) {
      if ((size_t)delimiter_index == scanner->delimiter_len) {
        if (lexer->lookahead == '"') {
          return true;
        }
        delimiter_index = -1;
      } else if ((wchar_t)lexer->lookahead == scanner->delimiter[delimiter_index]) {
        delimiter_index++;
      } else {
        delimiter_index = -1;
      }
    }

    if (delimiter_index == -1 && lexer->lookahead == ')') {
      lexer->mark_end(lexer);
      delimiter_index = 0;
    }

    lexer->advance(lexer, false);
  }
}

static bool scan(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols) {
  if (valid_symbols[RAW_STRING_CONTENT]) {
    lexer->result_symbol = RAW_STRING_CONTENT;
    return scan_raw_string_content(scanner, lexer);
  }

  if (valid_symbols[RAW_STRING_DELIMITER]) {
    lexer->result_symbol = RAW_STRING_DELIMITER;
    return scan_raw_string_delimiter(scanner, lexer);
  }

  return false;
}

void *tree_sitter_mql5_external_scanner_create() {
  Scanner *scanner = (Scanner *)calloc(1, sizeof(Scanner));
  if (!scanner) {
    return NULL;
  }
  scanner->delimiter = NULL;
  scanner->delimiter_len = 0;
  scanner->delimiter_cap = 0;
  return scanner;
}

bool tree_sitter_mql5_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;
  return scan(scanner, lexer, valid_symbols);
}

unsigned tree_sitter_mql5_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *scanner = (Scanner *)payload;
  size_t size = scanner->delimiter_len * sizeof(wchar_t);
  if (size > TREE_SITTER_SERIALIZATION_BUFFER_SIZE) {
    size = TREE_SITTER_SERIALIZATION_BUFFER_SIZE;
  }
  memcpy(buffer, scanner->delimiter, size);
  return (unsigned)size;
}

void tree_sitter_mql5_external_scanner_deserialize(void *payload,
                                                   const char *buffer,
                                                   unsigned length) {
  Scanner *scanner = (Scanner *)payload;
  if (length % sizeof(wchar_t) != 0) {
    scanner_reset(scanner);
    return;
  }

  size_t count = length / sizeof(wchar_t);
  if (!scanner_reserve(scanner, count)) {
    scanner_reset(scanner);
    return;
  }
  memcpy(scanner->delimiter, buffer, length);
  scanner->delimiter_len = count;
}

void tree_sitter_mql5_external_scanner_destroy(void *payload) {
  Scanner *scanner = (Scanner *)payload;
  if (!scanner) {
    return;
  }
  free(scanner->delimiter);
  free(scanner);
}
