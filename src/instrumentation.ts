import type { Instrumentation } from "next";
import { formatError } from "./lib/log-format";

/**
 * Next.js calls this for every error the server catches while rendering a page, running a Route Handler
 * or a Server Action: one JSON line in the logs, with the `digest` that the error page shows as 错误编号.
 * The request's headers are left out on purpose (they carry the session cookie) and so is its query string.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  console.error(
    formatError("request", error, {
      method: request.method,
      path: request.path.split("?")[0],
      route: context.routePath,
      routeType: context.routeType,
    }),
  );
};
