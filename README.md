# Error Store

A type-safe error management library for TypeScript. Define, build, and handle errors with a fluent API.

## Installation

```bash
npm install @yopadd/errors
```

## Features

- **Error Store**: Central registry for error definitions with codes and messages
- **Fluent Error Builder**: Create errors with metadata, custom messages, and causes
- **Type-Safe Error Handlers**: Build handlers that match specific error codes
- **Handler Composition**: Merge multiple error handlers together
- **Error Identification**: Type-safe error checking with `is()` method

## Usage

### Create an Error Store

```typescript
import { ErrorStore } from "@yopadd/errors";

const errors = new ErrorStore()
  .add({ code: "VALIDATION_ERROR", message: "Validation failed" })
  .add({ code: "NOT_FOUND", message: "Resource not found" })
  .add({ code: "UNAUTHORIZED", message: "Access denied" });
```

### Build Errors

Use the fluent `ErrorBuilder` to create errors from store definitions:

```typescript
// Basic error from store
const error = errors.new("VALIDATION_ERROR").build();

// Error with metadata
const errorWithMeta = errors
  .new("VALIDATION_ERROR")
  .metadata({ field: "email", reason: "invalid format" })
  .build();

// Error with custom message
const errorWithCustomMessage = errors
  .new("VALIDATION_ERROR")
  .overrideMessage((m) => `${m}: email must be valid`)
  .build();

// Error with cause
const errorWithCause = errors
  .new("VALIDATION_ERROR")
  .cause(new Error("Invalid email format"))
  .build();

// Combined
const fullError = errors
  .new("VALIDATION_ERROR")
  .metadata({ field: "email" })
  .overrideMessage((m) => `${m}: email must be valid`)
  .cause(new Error("Invalid email format"))
  .build();
```

The built error is a `RuntimeError` with:

- `code`: The error code (e.g., `"VALIDATION_ERROR"`)
- `message`: The error message (modified if `overrideMessage` was used)
- `metadata`: Optional object for additional context
- `cause`: Optional underlying error

### Create Error Handlers

Build type-safe handlers that match error codes to specific logic:

```typescript
const handler = errors
  .newHandler()
  .when("VALIDATION_ERROR", "NOT_FOUND", (err) => ({
    status: 400,
    body: { error: err.message, code: err.code },
  }))
  .when("UNAUTHORIZED", (err) => ({
    status: 403,
    body: { error: err.message, code: err.code },
  }))
  .otherwise((err) => ({
    status: 500,
    body: { error: "Internal Server Error" },
  }))
  .build();

// Use the handler
const result1 = handler(errors.new("VALIDATION_ERROR").build());
// => { status: 400, body: { error: "Validation failed", code: "VALIDATION_ERROR" } }

const result2 = handler(errors.new("UNAUTHORIZED").build());
// => { status: 403, body: { error: "Access denied", code: "UNAUTHORIZED" } }

const result3 = handler(new Error("Unknown error"));
// => { status: 500, body: { error: "Internal Server Error" } }
```

### Merge Handlers

Combine handlers from different error stores:

```typescript
const dbErrors = new ErrorStore().add({
  code: "DB_CONNECTION_FAILED",
  message: "Database connection failed",
});

const dbHandler = dbErrors
  .newHandler()
  .when("DB_CONNECTION_FAILED", (err) => ({
    status: 503,
    body: { error: err.message },
  }))
  .build();

const appHandler = errors
  .newHandler()
  .when("VALIDATION_ERROR", (err) => ({ status: 400, body: err.message }))
  .when("NOT_FOUND", (err) => ({ status: 404, body: err.message }))
  .merge(dbHandler)
  .otherwise((err) => ({ status: 500, body: "Internal Error" }))
  .build();
```

### Check Error Types

Use the `is()` method for type-safe error identification:

```typescript
const error = errors.new("VALIDATION_ERROR").build();

if (errors.is(error, "VALIDATION_ERROR")) {
  // TypeScript knows error is RuntimeError<"VALIDATION_ERROR">
  console.log(error.code); // "VALIDATION_ERROR"
}

// Also works with unknown values
function handleError(err: unknown) {
  if (errors.is(err, "VALIDATION_ERROR")) {
    // err is RuntimeError<"VALIDATION_ERROR">
  }
}
```

### Get Registered Codes

```typescript
const codes = errors.codes();
// => ["VALIDATION_ERROR", "NOT_FOUND", "UNAUTHORIZED"]
```

## API Reference

### ErrorStore

#### `.add(error)`

Register a new error definition.

- `error.code`: Unique error code (string)
- `error.message`: Default error message

Returns the `ErrorStore` instance for chaining.

#### `.new(code)`

Create a new `ErrorBuilder` for the specified error code.

#### `.newHandler()`

Create a new `ErrorHandlerBuilder` for this store's error codes.

#### `.codes()`

Get an array of all registered error codes.

#### `.is(err, code)`

Type guard to check if an unknown value is a `RuntimeError` with the specified code.

### ErrorBuilder

#### `.overrideMessage(fn)`

Transform the error message.

- `fn`: Function that receives the current message and returns the new message

Returns `this` for chaining.

#### `.cause(error)`

Set the underlying cause of the error.

- `error`: The underlying `Error` instance

Returns `this` for chaining.

#### `.metadata(metadata)`

Attach additional data to the error.

- `metadata`: Object with any additional context

Returns `this` for chaining.

#### `.build()`

Create the `RuntimeError` instance.

### ErrorHandlerBuilder

#### `.when(...codes, handler)`

Register a handler for specific error codes.

- `codes`: One or more error codes to match
- `handler`: Function that receives the `RuntimeError` and returns a result

Returns the builder for chaining.

#### `.otherwise(handler)`

Register a fallback handler for unmatched errors.

- `handler`: Function that receives any error and returns a result

Returns the builder for chaining.

#### `.merge(otherHandlerBuilder)`

Merge another handler builder's branches into this one.

- `otherHandlerBuilder`: Another `ErrorHandlerBuilder` instance

Returns a new `ErrorHandlerBuilder` with merged branches.

#### `.build<Input = any>()`

Create the error handler function.

- Returns: `(error: Input) => Result`

## Type Safety

The library provides strong TypeScript typing:

- Error codes are type-safe throughout the API
- `ErrorStore<Code>` is generic over the union of registered codes
- `when()` narrows the remaining codes as handlers are added
- `is()` provides type narrowing for error checking
- `RuntimeError<Code>` preserves the code type

## Examples

### HTTP Error Handling

```typescript
import { ErrorStore } from "errors-store";
import { Request, Response, NextFunction } from "express";

const errors = new ErrorStore()
  .add({ code: "BAD_REQUEST", message: "Bad Request" })
  .add({ code: "UNAUTHORIZED", message: "Unauthorized" })
  .add({ code: "FORBIDDEN", message: "Forbidden" })
  .add({ code: "NOT_FOUND", message: "Not Found" });

const errorHandler = errors
  .newHandler()
  .when("BAD_REQUEST", (err) => ({ status: 400, message: err.message }))
  .when("UNAUTHORIZED", (err) => ({ status: 401, message: err.message }))
  .when("FORBIDDEN", (err) => ({ status: 403, message: err.message }))
  .when("NOT_FOUND", (err) => ({ status: 404, message: err.message }))
  .otherwise((err) => ({ status: 500, message: "Internal Server Error" }))
  .build();

function middleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const result = errorHandler(err);
  res.status(result.status).json({ error: result.message });
}
```

### Domain-Specific Errors

```typescript
const userErrors = new ErrorStore()
  .add({ code: "USER_NOT_FOUND", message: "User not found" })
  .add({ code: "USER_ALREADY_EXISTS", message: "User already exists" })
  .add({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" });

function createUser(email: string, password: string) {
  // Validation logic...
  if (userExists(email)) {
    throw userErrors.new("USER_ALREADY_EXISTS").metadata({ email }).build();
  }

  if (!isValidPassword(password)) {
    throw userErrors
      .new("VALIDATION_ERROR")
      .metadata({ field: "password", reason: "too weak" })
      .build();
  }

  // ...
}

// Handle errors
try {
  createUser("test@example.com", "password");
} catch (err) {
  if (userErrors.is(err, "USER_ALREADY_EXISTS")) {
    console.log(`User ${err.metadata.email} already exists`);
  }
}
```

---

Code written by @yopadd. Documentation generated by Mistral Vibe.
