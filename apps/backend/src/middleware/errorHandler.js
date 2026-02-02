export const errorHandler = (err, req, res, next) => {
  console.error("Error occurred:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode =
    err.statusCode && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  const message = err.message || "Internal Server Error";

  if (res.headersSent) {
    return next(err);
  }
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: err.code || "INTERNAL_ERROR",
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
        details: err.details,
      }),
    },
    timestamp: new Date().toISOString(),
  });
};

export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
