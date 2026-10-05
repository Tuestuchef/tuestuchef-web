import { describe, expect, it } from "vitest"

import { buildDigests, type KindSetting, type Recipient } from "./digest.util"

const on = (kind: KindSetting["kind"], roles: KindSetting["roles"] = ["owner", "admin", "staff"]): KindSetting => ({
  kind,
  enabled: true,
  emailEnabled: true,
  pushEnabled: true,
  roles,
})

const owner: Recipient = { id: "o", role: "owner", email: "o@t.test", name: "Dueño", pushDevices: 1 }
const staff: Recipient = { id: "s", role: "staff", email: "s@t.test", name: "Staff", pushDevices: 0 }
const items = {
  late_orders: [
    { key: "1", title: "NE-000001 · Ana", detail: "Prometido el 01/10", url: "/pedidos/1" },
    { key: "2", title: "NE-000002 · Luis", detail: "Prometido el 02/10", url: "/pedidos/2" },
  ],
  payables_due: [{ key: "3", title: "C-000001 · Textiles", detail: "Vence el 05/10", url: "/compras/3" }],
}

describe("resumen de avisos", () => {
  it("un correo por persona con sus secciones y un push por aviso", () => {
    const { emails, pushes } = buildDigests({
      channels: { email: true, push: true },
      settings: [on("late_orders"), on("payables_due", ["owner", "admin"])],
      recipients: [owner, staff],
      items,
    })
    expect(emails.map((e) => [e.recipient.id, e.sections.map((s) => s.kind)])).toEqual([
      ["o", ["late_orders", "payables_due"]],
      ["s", ["late_orders"]],
    ])
    // Staff sin dispositivos: sin push. Owner: uno por aviso; varios ítems → enlace a la lista.
    expect(pushes.map((p) => [p.recipient.id, p.kind, p.url])).toEqual([
      ["o", "late_orders", "/pedidos?estado=late"],
      ["o", "payables_due", "/compras/3"],
    ])
  })

  it("respeta los interruptores: aviso apagado, canal apagado y canal del aviso apagado", () => {
    const off = { ...on("late_orders"), enabled: false }
    expect(buildDigests({ channels: { email: true, push: true }, settings: [off], recipients: [owner], items }).emails).toHaveLength(0)

    const noEmail = buildDigests({ channels: { email: false, push: true }, settings: [on("late_orders")], recipients: [owner], items })
    expect(noEmail.emails).toHaveLength(0)
    expect(noEmail.pushes).toHaveLength(1)

    const pushOff = { ...on("late_orders"), pushEnabled: false }
    expect(buildDigests({ channels: { email: true, push: true }, settings: [pushOff], recipients: [owner], items }).pushes).toHaveLength(0)
  })

  it("sin pendientes no se manda nada", () => {
    const { emails, pushes } = buildDigests({ channels: { email: true, push: true }, settings: [on("low_stock")], recipients: [owner], items: {} })
    expect(emails).toHaveLength(0)
    expect(pushes).toHaveLength(0)
  })
})
