export function getInitials(value: string): string {
  const words = value.split(/[\s@._-]+/).filter(Boolean)
  const initials = words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
  return initials.toUpperCase() || "?"
}
