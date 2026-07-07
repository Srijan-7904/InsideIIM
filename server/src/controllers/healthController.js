export function getHealth(_request, response) {
  response.json({
    ok: true,
    service: 'insideiim-server',
    timestamp: new Date().toISOString(),
  });
}
