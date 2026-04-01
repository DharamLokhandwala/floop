import { readFile } from "node:fs/promises";
import path from "node:path";

export type TokenMap = Record<string, string>;

export type DesignSystemSnapshot = {
  generatedAt: string;
  sources: {
    globalsCss: string;
    button: string;
    input: string;
    textarea: string;
    dialog: string;
    tooltip: string;
    auditViewer: string;
  };
  tokens: {
    root: TokenMap;
    dark: TokenMap;
    themeInline: TokenMap;
    pinCategoryHex: TokenMap;
  };
  componentRecipes: {
    button: {
      variants: string[];
      sizes: string[];
      baseClass: string;
    };
    input: string;
    textarea: string;
    dialogOverlay: string;
    dialogContent: string;
    tooltipContent: string;
  };
};

function abs(relPath: string): string {
  return path.join(process.cwd(), relPath);
}

async function read(relPath: string): Promise<string> {
  return readFile(abs(relPath), "utf8");
}

function parseCssVarsFromBlock(css: string, selector: string): TokenMap {
  const blockRegex = new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\}`);
  const match = css.match(blockRegex);
  if (!match) return {};

  const vars: TokenMap = {};
  const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null = null;
  while ((m = varRegex.exec(match[1])) !== null) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

function parseThemeInlineVars(css: string): TokenMap {
  const match = css.match(/@theme\s+inline\s*\{([\s\S]*?)\}/);
  if (!match) return {};
  const vars: TokenMap = {};
  const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null = null;
  while ((m = varRegex.exec(match[1])) !== null) {
    vars[`--${m[1]}`] = m[2].trim();
  }
  return vars;
}

function parseCvaKeys(block: string, key: "variant" | "size"): string[] {
  const regex =
    key === "variant"
      ? /variant:\s*\{([\s\S]*?)\}\s*,\s*size:/
      : /size:\s*\{([\s\S]*?)\}\s*,\s*\}\s*,\s*defaultVariants:/;
  const match = block.match(regex);
  if (!match) return [];
  const lines = match[1].split("\n");
  const keys = lines
    .map((line) => line.trim())
    .map((line) => {
      const m = line.match(/^"?([A-Za-z0-9-]+)"?\s*:/);
      return m ? m[1] : null;
    })
    .filter((k): k is string => !!k && k !== "defaultVariants");

  return [...new Set(keys)];
}

function parseClassFromCnCall(source: string): string {
  const m = source.match(/cn\(\s*"([^"]+)"/);
  return m ? m[1] : "";
}

function parseDialogClass(source: string, slot: "overlay" | "content"): string {
  const matcher =
    slot === "overlay"
      ? /data-slot="dialog-overlay"[\s\S]*?cn\(\s*"([^"]+)"/
      : /data-slot="dialog-content"[\s\S]*?cn\(\s*"([^"]+)"/;
  const m = source.match(matcher);
  return m ? m[1] : "";
}

function parseTooltipContentClass(source: string): string {
  const m = source.match(/data-slot="tooltip-content"[\s\S]*?cn\(\s*"([^"]+)"/);
  return m ? m[1] : "";
}

function parsePinCategoryHex(source: string): TokenMap {
  const map: TokenMap = {};
  const objMatch = source.match(/const CATEGORY_HEX:[\s\S]*?=\s*\{([\s\S]*?)\};/);
  if (!objMatch) return map;
  const lineRegex = /["]?([^"\n:]+)["]?\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null = null;
  while ((m = lineRegex.exec(objMatch[1])) !== null) {
    map[m[1].trim()] = m[2];
  }
  return map;
}

export async function getDesignSystemSnapshot(): Promise<DesignSystemSnapshot> {
  const [globalsCss, buttonSrc, inputSrc, textareaSrc, dialogSrc, tooltipSrc, auditViewerSrc] =
    await Promise.all([
      read("app/globals.css"),
      read("components/ui/button.tsx"),
      read("components/ui/input.tsx"),
      read("components/ui/textarea.tsx"),
      read("components/ui/dialog.tsx"),
      read("components/ui/tooltip.tsx"),
      read("components/AuditViewer.tsx"),
    ]);

  const buttonBase = buttonSrc.match(/const buttonVariants[\s\S]*?cva\(\s*"([^"]+)"/)?.[1] ?? "";

  return {
    generatedAt: new Date().toISOString(),
    sources: {
      globalsCss: "app/globals.css",
      button: "components/ui/button.tsx",
      input: "components/ui/input.tsx",
      textarea: "components/ui/textarea.tsx",
      dialog: "components/ui/dialog.tsx",
      tooltip: "components/ui/tooltip.tsx",
      auditViewer: "components/AuditViewer.tsx",
    },
    tokens: {
      root: parseCssVarsFromBlock(globalsCss, ":root"),
      dark: parseCssVarsFromBlock(globalsCss, ".dark"),
      themeInline: parseThemeInlineVars(globalsCss),
      pinCategoryHex: parsePinCategoryHex(auditViewerSrc),
    },
    componentRecipes: {
      button: {
        variants: parseCvaKeys(buttonSrc, "variant"),
        sizes: parseCvaKeys(buttonSrc, "size"),
        baseClass: buttonBase,
      },
      input: parseClassFromCnCall(inputSrc),
      textarea: parseClassFromCnCall(textareaSrc),
      dialogOverlay: parseDialogClass(dialogSrc, "overlay"),
      dialogContent: parseDialogClass(dialogSrc, "content"),
      tooltipContent: parseTooltipContentClass(tooltipSrc),
    },
  };
}
