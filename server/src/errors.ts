import type { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: number;

  constructor(
    code: string,
    message: string,
    status = 400,
    options: { retryAfter?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.retryAfter = options.retryAfter;
  }
}

export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "接口不存在。",
      requestId: res.locals.requestId,
    },
  });
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "LIMIT_FILE_SIZE"
  ) {
    appError = new AppError(
      "FILE_TOO_LARGE",
      "音频文件超过 25MB 上限，请压缩后再试。",
      413,
    );
  } else {
    appError = new AppError(
      "INTERNAL_ERROR",
      "服务端处理失败，请稍后重试。",
      500,
      { cause: error },
    );
  }

  if (appError.status >= 500) {
    console.error(
      `[${res.locals.requestId ?? "-"}] ${appError.code} (${appError.status})`,
    );
  }

  if (appError.retryAfter) {
    res.setHeader("Retry-After", String(appError.retryAfter));
  }

  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      requestId: res.locals.requestId,
      ...(appError.retryAfter ? { retryAfter: appError.retryAfter } : {}),
    },
  });
}
