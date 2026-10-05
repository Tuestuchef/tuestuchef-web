import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { oklchToHex } from "@/common/lib/utils/color.util"

import { DOCUMENT_THEME_SOURCE } from "./document-theme.config"

// Lee los tokens del tema claro (:root) de globals.css.
function rootTokens(): Record<string, string> {
  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8")
  const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ""
  return Object.fromEntries([...root.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

describe("tema de documentos", () => {
  it("usa los mismos colores que el tema claro de globals.css", () => {
    const tokens = rootTokens()
    for (const [token, value] of Object.entries(DOCUMENT_THEME_SOURCE)) {
      expect(tokens[token], `--${token} en globals.css`).toBe(value)
    }
  })
})

describe("oklchToHex", () => {
  it("convierte blancos, negros y grises", () => {
    expect(oklchToHex("oklch(1 0 0)")).toBe("#ffffff")
    expect(oklchToHex("oklch(0 0 0)")).toBe("#000000")
    expect(oklchToHex("oklch(0.556 0 0)")).toBe("#737373")
  })

  it("convierte colores con croma", () => {
    // Rojo sRGB puro ≈ oklch(0.628 0.2577 29.23).
    expect(oklchToHex("oklch(0.628 0.2577 29.23)")).toBe("#ff0000")
  })
})
