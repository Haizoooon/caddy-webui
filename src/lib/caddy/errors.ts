import type { CaddyWarning } from "./types";

export class CaddyError extends Error {
  status: number;
  warnings: CaddyWarning[];

  constructor(message: string, status = 502, warnings: CaddyWarning[] = []) {
    super(message);
    this.name = "CaddyError";
    this.status = status;
    this.warnings = warnings;
  }
}

export class ApiError extends Error {
  status: number;
  issues?: Record<string, string>;
  warnings?: CaddyWarning[];

  constructor(
    message: string,
    status = 400,
    options: { issues?: Record<string, string>; warnings?: CaddyWarning[] } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = options.issues;
    this.warnings = options.warnings;
  }
}
