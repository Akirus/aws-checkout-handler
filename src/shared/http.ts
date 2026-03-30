import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

export function handleHttpError(error: unknown): APIGatewayProxyStructuredResultV2 {
  if (error instanceof HttpError) {
    return jsonResponse(error.statusCode, {
      error: error.message,
      details: error.details
    });
  }

  console.error("Unexpected handler error", error);

  return jsonResponse(500, {
    error: "Internal server error"
  });
}

export function enforceRoute(
  event: APIGatewayProxyEventV2,
  input: { method: string; path: string }
): void {
  const actualMethod = event.requestContext.http.method;
  const actualPath = event.rawPath;

  if (actualMethod !== input.method || actualPath !== input.path) {
    throw new HttpError(404, `Route ${actualMethod} ${actualPath} not found`);
  }
}
