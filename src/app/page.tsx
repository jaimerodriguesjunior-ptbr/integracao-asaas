import { revalidatePath } from "next/cache";

import { ProgramCreateModal } from "@/components/ProgramCreateModal";
import { PwaClient } from "@/components/PwaClient";
import { createApiClient, listClientStoreEvents } from "@/lib/store-billing";
import {
  calculateStoreBillingSnapshotWithPayment,
  getClientStoreById,
  getGatewayPixSettings,
  listApiClients,
  listClientStores,
  markStorePaidOneMonth,
  releaseStoreForThreeDays,
  upsertGatewayPixSettings,
  upsertClientStoreByClientId
} from "@/lib/store-billing";

export const dynamic = "force-dynamic";

type StoreWithClient = Awaited<ReturnType<typeof listClientStores>>[number] & {
  api_clients?: {
    name?: string;
    client_key?: string;
  };
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formNumber(formData: FormData, key: string, fallback: number) {
  const value = formString(formData, key);
  if (!value) {
    return fallback;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function saveStore(formData: FormData) {
  "use server";

  const clientId = formString(formData, "client_id");
  const storeId = formString(formData, "store_id");
  const storeName = formString(formData, "store_name");

  if (!clientId || !storeId || !storeName) {
    return;
  }

  await upsertClientStoreByClientId(clientId, {
    storeId,
    storeName,
    storeDocument: formString(formData, "store_document"),
    monthlyAmount: formNumber(formData, "monthly_amount", 0),
    paidUntil: formString(formData, "paid_until"),
    graceDays: formNumber(formData, "grace_days", 15),
    isVip: formData.get("is_vip") === "on",
    manualReleaseUntil: formString(formData, "manual_release_until"),
    paymentQrCode: formString(formData, "payment_qr_code"),
    paymentCopyPaste: formString(formData, "payment_copy_paste"),
    notes: formString(formData, "notes"),
    active: formData.getAll("active").includes("on")
  });

  revalidatePath("/");
}

async function saveProgram(formData: FormData) {
  "use server";

  const name = formString(formData, "name");
  const clientKey = formString(formData, "client_key");
  const clientSecret = formString(formData, "client_secret");
  const webhookUrl = formString(formData, "webhook_url");

  if (!name || !clientKey || !clientSecret || !webhookUrl) {
    return;
  }

  await createApiClient({
    name,
    clientKey,
    clientSecret,
    webhookUrl
  });

  revalidatePath("/");
}

async function savePixSettings(formData: FormData) {
  "use server";

  const pixKey = formString(formData, "pix_key");
  const merchantName = formString(formData, "merchant_name");
  const merchantCity = formString(formData, "merchant_city");

  if (!pixKey || !merchantName || !merchantCity) {
    return;
  }

  await upsertGatewayPixSettings({
    pixKey,
    merchantName,
    merchantCity,
    description: formString(formData, "description"),
    txidPrefix: formString(formData, "txid_prefix"),
    active: formData.getAll("active").includes("on")
  });

  revalidatePath("/");
}

async function paidOneMonth(formData: FormData) {
  "use server";

  const store = await getClientStoreById(String(formData.get("id") ?? ""));
  if (!store) {
    return;
  }

  await markStorePaidOneMonth(store, formString(formData, "notes"));
  revalidatePath("/");
}

async function releaseThreeDays(formData: FormData) {
  "use server";

  const store = await getClientStoreById(String(formData.get("id") ?? ""));
  if (!store) {
    return;
  }

  await releaseStoreForThreeDays(store, formString(formData, "notes"));
  revalidatePath("/");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ativo: "Ativo",
    pendente: "Pendente",
    bloqueado: "Bloqueado",
    liberado: "Liberado",
    vip: "VIP"
  };

  return labels[status] ?? status;
}

function statusStyle(status: string) {
  const colors: Record<string, { background: string; color: string }> = {
    ativo: { background: "#d9f99d", color: "#365314" },
    pendente: { background: "#fef3c7", color: "#92400e" },
    bloqueado: { background: "#fee2e2", color: "#991b1b" },
    liberado: { background: "#dbeafe", color: "#1e40af" },
    vip: { background: "#dcfce7", color: "#166534" }
  };

  return colors[status] ?? { background: "#e5e7eb", color: "#111827" };
}

function inputStyle() {
  return {
    border: "1px solid #d6d3d1",
    boxSizing: "border-box" as const,
    borderRadius: 6,
    font: "inherit",
    padding: "9px 10px",
    width: "100%"
  };
}

function Field(props: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: 13, minWidth: 0, color: "#57534e" }}>
      <span>{props.label}</span>
      {props.textarea ? (
        <textarea
          name={props.name}
          defaultValue={props.defaultValue ?? ""}
          rows={3}
          style={{ ...inputStyle(), resize: "vertical" }}
        />
      ) : (
        <input name={props.name} defaultValue={props.defaultValue ?? ""} type={props.type ?? "text"} style={inputStyle()} />
      )}
    </label>
  );
}

export default async function HomePage() {
  const [clients, stores, pixSettings] = await Promise.all([listApiClients(), listClientStores(), getGatewayPixSettings()]);
  const events = await listClientStoreEvents((stores as StoreWithClient[]).map((store) => store.id));
  const eventsByStoreId = new Map<string, typeof events>();

  for (const event of events) {
    const current = eventsByStoreId.get(event.client_store_id) ?? [];
    if (current.length < 8) {
      current.push(event);
      eventsByStoreId.set(event.client_store_id, current);
    }
  }

  const snapshots = await Promise.all((stores as StoreWithClient[]).map((store) => calculateStoreBillingSnapshotWithPayment(store)));

  return (
    <main
      style={{
        background: "#f7f4ef",
        boxSizing: "border-box",
        color: "#292524",
        fontFamily: "Cambria, Georgia, serif",
        minHeight: "100vh",
        padding: 28
      }}
    >
      <PwaClient />
      <section style={{ boxSizing: "border-box", margin: "0 auto", maxWidth: 1180, width: "100%" }}>
        <header
          style={{
            alignItems: "start",
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            marginBottom: 24
          }}
        >
          <div>
            <p style={{ color: "#78716c", margin: "0 0 6px" }}>Gateway de mensalidades</p>
            <h1 style={{ fontSize: 34, lineHeight: 1.1, margin: 0 }}>Controle manual de cobrança por loja</h1>
          </div>
          <div style={{ color: "#57534e", fontSize: 14, minWidth: 0, maxWidth: 360 }}>
            Os programas consultam o gateway. O bloqueio deve limitar novas operações, preservando acesso a dados e relatórios antigos.
          </div>
        </header>

        <details
          style={{
            background: "#fffdf8",
            border: "1px solid #e7e5e4",
            boxSizing: "border-box",
            borderRadius: 8,
            marginBottom: 22,
            overflow: "hidden"
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 700,
              listStyle: "none",
              padding: 18
            }}
          >
            Nova Loja
          </summary>
          <form
            action={saveStore}
            style={{
              borderTop: "1px solid #efe9df",
              display: "grid",
              gap: 14,
              padding: 18,
              paddingTop: 16
            }}
          >
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 13, color: "#57534e" }}>Programa</span>
                <div style={{ alignItems: "center", display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) auto" }}>
                  <select name="client_id" required style={inputStyle()}>
                    <option value="">Selecione</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name} ({client.client_key})
                      </option>
                    ))}
                  </select>
                  <ProgramCreateModal action={saveProgram} />
                </div>
              </div>
              <Field label="ID da loja no programa" name="store_id" />
              <Field label="Nome da loja" name="store_name" />
              <Field label="Documento" name="store_document" />
              <Field label="Mensalidade" name="monthly_amount" type="number" />
              <Field label="Pago ate" name="paid_until" type="date" />
              <Field label="Carencia em dias" name="grace_days" type="number" defaultValue={15} />
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <Field label="Observacao" name="notes" textarea />
            </div>
            <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 16 }}>
              <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <input name="is_vip" type="checkbox" />
                Cliente VIP
              </label>
              <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <input name="active" type="checkbox" defaultChecked />
                Loja ativa
              </label>
              <button
                style={{
                  background: "#1c1917",
                  border: 0,
                  borderRadius: 6,
                  color: "white",
                  cursor: "pointer",
                  font: "inherit",
                  padding: "10px 14px"
                }}
                type="submit"
              >
                Salvar loja
              </button>
            </div>
          </form>
        </details>

        <details
          style={{
            background: "#fffdf8",
            border: "1px solid #e7e5e4",
            boxSizing: "border-box",
            borderRadius: 8,
            marginBottom: 22,
            overflow: "hidden"
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 700,
              listStyle: "none",
              padding: 18
            }}
          >
            PIX
          </summary>
          <form
            action={savePixSettings}
            style={{
              borderTop: "1px solid #efe9df",
              display: "grid",
              gap: 14,
              padding: 18,
              paddingTop: 16
            }}
          >
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
              <Field label="Chave Pix" name="pix_key" defaultValue={pixSettings?.pix_key} />
              <Field label="Nome do recebedor" name="merchant_name" defaultValue={pixSettings?.merchant_name} />
              <Field label="Cidade do recebedor" name="merchant_city" defaultValue={pixSettings?.merchant_city} />
              <Field label="Prefixo TXID" name="txid_prefix" defaultValue={pixSettings?.txid_prefix ?? "MENSAL"} />
            </div>
            <Field label="Descricao no Pix" name="description" defaultValue={pixSettings?.description ?? "Mensalidade do sistema"} />
            <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 16 }}>
              <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <input name="active" type="checkbox" defaultChecked={pixSettings?.active ?? true} />
                Pix ativo
              </label>
              <button style={secondaryButtonStyle} type="submit">
                Salvar Pix
              </button>
            </div>
            <div
              style={{
                background: "#f8f5ef",
                border: "1px solid #ece7df",
                borderRadius: 6,
                color: "#57534e",
                display: "grid",
                fontSize: 13,
                gap: 6,
                padding: 12
              }}
            >
              {pixSettings ? (
                <>
                  <div>
                    <strong>Status:</strong> {pixSettings.active ? "Ativo" : "Inativo"}
                  </div>
                  <div>
                    <strong>Recebedor:</strong> {pixSettings.merchant_name} - {pixSettings.merchant_city}
                  </div>
                  <div>
                    <strong>Chave:</strong> {pixSettings.pix_key}
                  </div>
                  <div>
                    <strong>Descricao:</strong> {pixSettings.description ?? "sem descricao"}
                  </div>
                  <div>
                    <strong>TXID:</strong> {pixSettings.txid_prefix ?? "sem prefixo"}
                  </div>
                </>
              ) : (
                <div>Pix ainda nao configurado.</div>
              )}
            </div>
          </form>
        </details>

        <div style={{ display: "grid", gap: 14 }}>
          {snapshots.map((snapshot) => (
            <details
              key={snapshot.store.id}
              style={{
                background: "#fffdf8",
                border: "1px solid #e7e5e4",
                boxSizing: "border-box",
                borderRadius: 8,
                overflow: "hidden"
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  listStyle: "none",
                  padding: 18
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 22, margin: 0 }}>{snapshot.store.store_name}</h2>
                    <span
                      style={{
                        ...statusStyle(snapshot.status),
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        padding: "4px 9px",
                        textTransform: "uppercase"
                      }}
                    >
                      {statusLabel(snapshot.status)}
                    </span>
                  </div>
                  <p style={{ color: "#78716c", margin: 0 }}>
                    {(snapshot.store as StoreWithClient).api_clients?.name ?? "Programa"} · loja {snapshot.store.store_id}
                  </p>
                </div>
                <div style={{ color: "#57534e", fontSize: 14, minWidth: 0, textAlign: "right" }}>
                  <div>Pago ate: {snapshot.store.paid_until ?? "sem data"}</div>
                  <div>Bloqueia apos: {snapshot.blockAfter ?? "sem carencia"}</div>
                  <div>Liberado ate: {snapshot.store.manual_release_until ?? "nao"}</div>
                </div>
              </summary>

              <div style={{ borderTop: "1px solid #efe9df", display: "grid", gap: 14, padding: 18 }}>
              <form action={saveStore} style={{ display: "grid", gap: 12 }}>
                <input name="client_id" type="hidden" value={snapshot.store.client_id} />
                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                  <Field label="ID da loja" name="store_id" defaultValue={snapshot.store.store_id} />
                  <Field label="Nome" name="store_name" defaultValue={snapshot.store.store_name} />
                  <Field label="Documento" name="store_document" defaultValue={snapshot.store.store_document} />
                  <Field label="Mensalidade" name="monthly_amount" type="number" defaultValue={snapshot.store.monthly_amount} />
                  <Field label="Pago ate" name="paid_until" type="date" defaultValue={snapshot.store.paid_until} />
                  <Field label="Carencia" name="grace_days" type="number" defaultValue={snapshot.store.grace_days} />
                  <Field
                    label="Liberado ate"
                    name="manual_release_until"
                    type="date"
                    defaultValue={snapshot.store.manual_release_until}
                  />
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  <Field label="Observacao" name="notes" defaultValue={snapshot.store.notes} textarea />
                </div>
                <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 12 }}>
                  <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                    <input name="is_vip" type="checkbox" defaultChecked={snapshot.store.is_vip} />
                    VIP
                  </label>
                  <label style={{ alignItems: "center", display: "flex", gap: 8 }}>
                    <input name="active" type="checkbox" defaultChecked={snapshot.store.active} />
                    Ativa
                  </label>
                  <button style={secondaryButtonStyle} type="submit">
                    Atualizar
                  </button>
                </div>
              </form>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <form action={paidOneMonth}>
                  <input name="id" type="hidden" value={snapshot.store.id} />
                  <input name="notes" type="hidden" value={snapshot.store.notes ?? ""} />
                  <button style={primaryButtonStyle} type="submit">
                    Pago esse mes
                  </button>
                </form>
                <form action={releaseThreeDays}>
                  <input name="id" type="hidden" value={snapshot.store.id} />
                  <input name="notes" type="hidden" value={snapshot.store.notes ?? ""} />
                  <button style={secondaryButtonStyle} type="submit">
                    Liberar 3 dias
                  </button>
                </form>
              </div>

              <section
                style={{
                  background: "#f8f5ef",
                  border: "1px solid #ece7df",
                  borderRadius: 6,
                  display: "grid",
                  gap: 10,
                  padding: 14
                }}
              >
                <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong style={{ fontSize: 14 }}>Historico da loja</strong>
                  <span style={{ color: "#78716c", fontSize: 12 }}>
                    {eventsByStoreId.get(snapshot.store.id)?.length ?? 0} evento(s) recentes
                  </span>
                </div>

                {(eventsByStoreId.get(snapshot.store.id) ?? []).length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {(eventsByStoreId.get(snapshot.store.id) ?? []).map((event) => (
                      <div
                        key={event.id}
                        style={{
                          background: "#fffdf8",
                          border: "1px solid #e7e5e4",
                          borderRadius: 6,
                          display: "grid",
                          gap: 4,
                          padding: 10
                        }}
                      >
                        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between" }}>
                          <strong style={{ fontSize: 13 }}>{formatEventType(event.event_type)}</strong>
                          <span style={{ color: "#78716c", fontSize: 12 }}>{formatDateTime(event.created_at)}</span>
                        </div>
                        <div style={{ color: "#57534e", fontSize: 13 }}>
                          {describeEvent(event)}
                        </div>
                        {event.notes ? <div style={{ color: "#78716c", fontSize: 12 }}>Obs: {event.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#78716c", fontSize: 13 }}>Nenhum evento registrado ainda.</div>
                )}
              </section>
              </div>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

const primaryButtonStyle = {
  background: "#365314",
  border: 0,
  borderRadius: 6,
  color: "white",
  cursor: "pointer",
  font: "inherit",
  padding: "9px 12px"
};

const secondaryButtonStyle = {
  background: "#f5f5f4",
  border: "1px solid #d6d3d1",
  borderRadius: 6,
  color: "#292524",
  cursor: "pointer",
  font: "inherit",
  padding: "9px 12px"
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatEventType(eventType: string) {
  const labels: Record<string, string> = {
    store_created: "Loja cadastrada",
    store_updated: "Loja atualizada",
    paid_one_month: "Pagamento validado",
    manual_release_3_days: "Liberacao de 3 dias"
  };

  return labels[eventType] ?? eventType;
}

function describeEvent(event: {
  event_type: string;
  previous_paid_until: string | null;
  next_paid_until: string | null;
  previous_release_until: string | null;
  next_release_until: string | null;
}) {
  if (event.event_type === "paid_one_month") {
    return `Pago ate foi de ${event.previous_paid_until ?? "sem data"} para ${event.next_paid_until ?? "sem data"}.`;
  }

  if (event.event_type === "manual_release_3_days") {
    return `Liberacao foi de ${event.previous_release_until ?? "sem data"} para ${event.next_release_until ?? "sem data"}.`;
  }

  if (event.event_type === "store_created") {
    return "Cadastro inicial da loja no gateway.";
  }

  if (event.event_type === "store_updated") {
    return `Configuracao atualizada. Pago ate: ${event.next_paid_until ?? "sem data"}. Liberado ate: ${event.next_release_until ?? "sem data"}.`;
  }

  return "Evento registrado no gateway.";
}
