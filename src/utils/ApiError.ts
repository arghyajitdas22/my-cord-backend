class ApiError extends Error {
  statusCode: number;
  data: null;
  message: string;
  success: boolean;
  errors: any[];

  constructor(
    statusCode: number,
    message: string = "Something went wrong",
    errors: any[] = [],
    stack: string = ""
  ) {
    super(message); // Call the parent class constructor (Error)
    this.statusCode = statusCode;
    this.data = null; // Typically, errors don't have data, so it's set to null
    this.message = message;
    this.success = false; // Errors are not successful operations
    this.errors = errors; // Array of errors (for validation or multiple errors)

    // Handle stack trace
    if (stack) {
      this.stack = stack; // Use the provided stack trace
    } else {
      Error.captureStackTrace(this, this.constructor); // Capture the stack trace
    }
  }
}

export { ApiError };
