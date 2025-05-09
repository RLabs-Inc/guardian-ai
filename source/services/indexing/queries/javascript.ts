// source/services/indexing/queries/javascript.ts

/**
 * Tree-sitter queries for JavaScript/TypeScript
 */

// Query to extract function declarations
export const FUNCTION_QUERY = `
(function_declaration
  name: (identifier) @function.name
) @function.declaration

(method_definition
  name: (property_identifier) @method.name
) @method.declaration

(arrow_function
  parameter: (identifier) @arrow.param
) @arrow.function
`;

// Query to extract class declarations
export const CLASS_QUERY = `
(class_declaration
  name: (identifier) @class.name
) @class.declaration
`;

// Query to extract interface declarations (TypeScript)
export const INTERFACE_QUERY = `
(interface_declaration
  name: (type_identifier) @interface.name
) @interface.declaration
`;

// Query to extract imports
export const IMPORT_QUERY = `
(import_statement
  source: (string) @import.source
) @import.declaration

(import_specifier
  name: (identifier) @import.name
) @import.specifier
`;

// Query to extract exports
export const EXPORT_QUERY = `
(export_statement
  declaration: (function_declaration
    name: (identifier) @export.function.name
  )
) @export.function

(export_statement
  declaration: (class_declaration
    name: (identifier) @export.class.name
  )
) @export.class
`;