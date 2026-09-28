import {ProviderDiagnostic} from "@/types";

/** Upstream failure with the detail we want to show the user instead of hiding it. */
export class ProviderError extends Error {
  status?: number;
  code: string;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export const summarise = (text: string) => {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
};

export const diagnosticFrom = (
  error: unknown,
  provider: ProviderDiagnostic["provider"],
  model?: string
): ProviderDiagnostic => ({
  provider,
  model,
  status: error instanceof ProviderError ? error.status : undefined,
  message: error instanceof Error ? error.message : String(error)
});
