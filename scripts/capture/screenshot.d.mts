import type { Page } from "@playwright/test";

export declare function captureFullPage(
  page: Page,
  filePath: string
): Promise<void>;
