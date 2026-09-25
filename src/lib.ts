type ErrorHandler<Input, Result> = (err: Input) => Result;

export class RuntimeError<Code = string> extends Error {
  readonly code: Code;
  readonly metadata: Record<string, any> | undefined;
  constructor(
    input: { code: Code; message: string },
    options?: {
      metadata: Record<string, any> | undefined;
      cause: Error | undefined;
    },
  ) {
    super(input.message, options);
    this.code = input.code;
    this.metadata = options?.metadata;
  }
}

class ErrorBuilder<Code = string> {
  readonly #code: Code;
  #message: string;
  #cause: Error | undefined;
  #metadata: Record<string, any> | undefined;

  constructor(input: { code: Code; message: string }) {
    this.#code = input.code;
    this.#message = input.message;
  }

  overrideMessage(fn: (m: string) => string): this {
    this.#message = fn(this.#message);
    return this;
  }

  cause(cause: Error): this {
    this.#cause = cause;
    return this;
  }

  metadata(metadata: Record<string, any>): this {
    this.#metadata = metadata;
    return this;
  }

  build(): RuntimeError<Code> {
    return new RuntimeError(
      { code: this.#code, message: this.#message },
      { cause: this.#cause, metadata: this.#metadata },
    );
  }
}

export class ErrorHandlerBuilder<Code = string, Result = never> {
  readonly #branches: Map<string, (err: RuntimeError) => any>;
  #otherwise?: (err: RuntimeError) => any;

  constructor(branches: Map<string, (err: RuntimeError) => any> = new Map()) {
    this.#branches = branches;
  }

  when<C extends Code, R>(
    ...args: [...C[], (err: RuntimeError<C>) => R]
  ): Exclude<Code, C> extends never
    ? ErrorHandlerBuilder<never, Result | R>
    : Omit<
        ErrorHandlerBuilder<Exclude<Code, C>, Result | R>,
        "build" | "otherwise" | "merge"
      > {
    const handler = args.pop()! as (err: RuntimeError) => R;
    for (let code of args) {
      this.#branches.set(code as string, handler);
    }
    return this;
  }

  otherwise<D>(
    fn: (err: unknown) => D,
  ): ErrorHandlerBuilder<never, Result | D> {
    this.#otherwise = fn;
    return this;
  }

  merge<R>(
    ehb: ErrorHandlerBuilder<never, R>,
  ): ErrorHandlerBuilder<never, Result | R> {
    const branches = new Map([
      ...this.#branches.entries(),
      ...ehb.#branches.entries(),
    ]);
    return new ErrorHandlerBuilder(branches);
  }

  build<Input = any>(): ErrorHandler<Input, Result> {
    const fn = (error: any) => {
      for (const [code, handler] of this.#branches) {
        if (code === error.code) {
          return handler(error);
        }
      }
      return this.#otherwise?.(error);
    };
    return fn;
  }
}

export class ErrorStore<Code extends string = never> {
  readonly #store: Record<string, string> = {};

  add<C extends string>(error: {
    code: C;
    message: string;
  }): ErrorStore<Code | C> {
    this.#store[error.code] = error.message;
    return this;
  }

  new<C extends Code>(code: C) {
    const message = this.#store[code as string]!;
    return new ErrorBuilder<C>({
      code,
      message,
    });
  }

  newHandler(): Omit<
    ErrorHandlerBuilder<Code>,
    "build" | "otherwise" | "merge"
  > {
    return new ErrorHandlerBuilder<Code>();
  }

  codes(): Code[] {
    return Object.keys(this.#store) as Code[];
  }

  is(err: unknown, code: Code): err is RuntimeError<Code> {
    return err instanceof RuntimeError ? err.code === code : false;
  }
}

export type ErrorCodes<ES extends ErrorStore<any>> =
  ES extends ErrorStore<infer C> ? C : never;

export type RuntimeErrorOf<ES extends ErrorStore<any>> = RuntimeError<
  ErrorCodes<ES>
>;
