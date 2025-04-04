// Basic Error Handling Middleware
const errorHandler = (err, req, res, next) => {
  console.error('ERROR:', err.stack || err);

  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // In production, avoid exposing sensitive error details if not operational
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
      message = 'Something went wrong!';
  }

  res.status(statusCode).json({
      status: 'error',
      message: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
