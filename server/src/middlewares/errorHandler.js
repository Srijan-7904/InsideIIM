export function notFound(_request, response) {
  response.status(404).json({
    message: 'Route not found',
  });
}

export function errorHandler(error, _request, response, _next) {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  response.status(statusCode).json({
    message,
  });
}
