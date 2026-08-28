import test, { describe } from "node:test";
import { ErrorStore, RuntimeError } from "../src/lib.js";
import assert from "node:assert/strict";

const errors = new ErrorStore()
  .add({
    code: "CODE_001",
    message: "Message 001",
  })
  .add({
    code: "CODE_002",
    message: "Message 002",
  })
  .add({
    code: "CODE_003",
    message: "Message 003",
  });

describe("Error Builder API", () => {
  test("create new error", () => {
    const error = errors
      .new("CODE_001")
      .metadata({ foo: "bar" })
      .overrideMessage((m) => m.toLocaleUpperCase())
      .cause(new Error("something goes wrong"))
      .build();

    assert(error instanceof RuntimeError);
    assert.equal(error.code, "CODE_001");
    assert.equal(error.message, "MESSAGE 001");
    assert.deepEqual(error.metadata, { foo: "bar" });
    assert(error.cause instanceof Error);
    assert.equal(error.cause.message, "something goes wrong");
  });
});

describe("Error Handler API", () => {
  const handlerBuilder = errors
    .newHandler()
    .when("CODE_001", "CODE_002", (err) => ({
      status: "Info" as const,
      message: err.message,
    }))
    .when("CODE_003", (err) => ({
      status: "Warning" as const,
      message: err.message,
    }))
    .otherwise(() => ({
      status: "Panic" as const,
      message: "Internal Error",
    }));

  test("create new handler", () => {
    const handler = handlerBuilder.build<Error>();

    const error1 = errors.new("CODE_001").build();
    const error2 = errors.new("CODE_002").build();
    const error3 = errors.new("CODE_003").build();

    assert.deepEqual(handler(error1), {
      status: "Info",
      message: "Message 001",
    });
    assert.deepEqual(handler(error2), {
      status: "Info",
      message: "Message 002",
    });
    assert.deepEqual(handler(error3), {
      status: "Warning",
      message: "Message 003",
    });
    assert.deepEqual(handler(new Error("something goes wrong")), {
      status: "Panic",
      message: "Internal Error",
    });
  });

  test("merge handlers", () => {
    const otherErrors = new ErrorStore().add({
      code: "OTHER_ERROR",
      message: "Other Error",
    });

    const otherHandler = otherErrors
      .newHandler()
      .when("OTHER_ERROR", (err) => err.message);

    const superHandler = handlerBuilder
      .merge(otherHandler)
      .otherwise(() => ({
        status: "INTERNAL_ERROR",
        message: "Internal Error",
      }))
      .build();

    const error1 = errors.new("CODE_001").build();
    const error2 = errors.new("CODE_002").build();
    const error3 = errors.new("CODE_003").build();
    const error4 = otherErrors.new("OTHER_ERROR").build();

    assert.deepEqual(superHandler(error1), {
      status: "Info",
      message: "Message 001",
    });
    assert.deepEqual(superHandler(error2), {
      status: "Info",
      message: "Message 002",
    });
    assert.deepEqual(superHandler(error3), {
      status: "Warning",
      message: "Message 003",
    });
    assert.equal(superHandler(error4), "Other Error");
    assert.deepEqual(superHandler(new Error("something goes wrong")), {
      status: "INTERNAL_ERROR",
      message: "Internal Error",
    });
  });
});

describe("Comparaison API", () => {
  test("is", () => {
    const error = errors.new("CODE_001").build();

    const otherErrors = new ErrorStore()
      .add({
        code: "OTHER_ERROR",
        message: "Other Error",
      })
      .add({
        code: "CODE_001",
        message: "Other Code 001 Error",
      });

    const otherError = otherErrors.new("OTHER_ERROR").build();

    assert.equal(errors.is(error, "CODE_001"), true);
    assert.equal(errors.is(error, "CODE_002"), false);
    assert.equal(errors.is(otherError, "CODE_001"), false);
    assert.equal(errors.is({}, "CODE_001"), false);
    assert.equal(
      errors.is(
        {
          code: "CODE_001",
        },
        "CODE_001",
      ),
      false,
    );
    assert.equal(
      errors.is(otherErrors.new("CODE_001").build(), "CODE_001"),
      true,
    );
  });

  test("codes", () => {
    const codes = errors.codes();
    assert.equal(codes.length, 3);
    assert(codes.includes("CODE_001"));
    assert(codes.includes("CODE_002"));
    assert(codes.includes("CODE_003"));
  });
});
