// Basic Error Handling Middleware

const errorHandler = (err, req, res, next) => {
  console.error('ERROR:', err.stack || err); // Log error stack trace to console

  // Default error status and message
  let statusCode = err.statusCode || 500; // Use specific status code if available, otherwise default to 500
  let message = err.message || 'Internal Server Error';

  // Customize error response based on environment or error type if needed
  // Example: Don't expose stack trace in production
  if (process.env.NODE_ENV === 'production' && !err.isOperational) {
      message = 'Something went wrong!';
      // Potentially log more details to a dedicated logging service
  }

  // Set response status code and send JSON error response
  res.status(statusCode).json({
      status: 'error',
      message: message,
      // Optionally include stack trace in development
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;