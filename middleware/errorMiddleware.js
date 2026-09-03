export const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Not found - ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, next) => {
  const status = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(status).json({
    success: false,
    message: err.message || "Server error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};
