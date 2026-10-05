// oklch(L C H) → #rrggbb, para lo que no entiende variables CSS ni oklch (p. ej. el PDF).
// L de 0 a 1 (o porcentaje), C croma, H en grados.
export function oklchToHex(value: string): string {
  const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim())
  if (!match) throw new Error(`Color oklch inválido: ${value}`)
  const l = match[1].endsWith("%") ? Number(match[1].slice(0, -1)) / 100 : Number(match[1])
  const c = Number(match[2])
  const h = (Number(match[3]) * Math.PI) / 180

  // OKLCH → OKLab → LMS → sRGB lineal (matrices de Björn Ottosson).
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  return (
    "#" +
    linear
      .map((channel) => {
        const clamped = Math.min(1, Math.max(0, channel))
        const srgb = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
        return Math.round(srgb * 255)
          .toString(16)
          .padStart(2, "0")
      })
      .join("")
  )
}
