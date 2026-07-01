"use client";

import { useState } from "react";

type ProgramCreateModalProps = {
  action: (formData: FormData) => Promise<void>;
};

export function ProgramCreateModal({ action }: ProgramCreateModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          alignItems: "center",
          background: "#f5f5f4",
          border: "1px solid #d6d3d1",
          borderRadius: 6,
          color: "#292524",
          cursor: "pointer",
          display: "inline-flex",
          font: "inherit",
          fontSize: 18,
          height: 40,
          justifyContent: "center",
          width: 40
        }}
        type="button"
        title="Cadastrar programa"
      >
        +
      </button>

      {open ? (
        <div
          style={{
            alignItems: "center",
            background: "rgba(28, 25, 23, 0.28)",
            bottom: 0,
            display: "flex",
            justifyContent: "center",
            left: 0,
            padding: 24,
            position: "fixed",
            right: 0,
            top: 0,
            zIndex: 50
          }}
        >
          <div
            style={{
              background: "#fffdf8",
              border: "1px solid #e7e5e4",
              borderRadius: 8,
              boxSizing: "border-box",
              display: "grid",
              gap: 14,
              maxWidth: 520,
              padding: 20,
              width: "100%"
            }}
          >
            <div style={{ alignItems: "start", display: "flex", gap: 16, justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 22, margin: 0 }}>Novo programa</h2>
                <p style={{ color: "#78716c", fontSize: 14, margin: "6px 0 0" }}>
                  Esse cadastro define quem pode consultar o gateway por `x-client-key` e `x-client-secret`.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: 0,
                  color: "#78716c",
                  cursor: "pointer",
                  font: "inherit",
                  fontSize: 20,
                  lineHeight: 1
                }}
                type="button"
                title="Fechar"
              >
                x
              </button>
            </div>

            <form
              action={async (formData) => {
                await action(formData);
                setOpen(false);
              }}
              style={{ display: "grid", gap: 12 }}
            >
              <Field label="Nome do programa" name="name" />
              <Field label="Chave do programa" name="client_key" placeholder="autoeletrica" />
              <Field label="Segredo do programa" name="client_secret" type="password" />
              <Field label="Webhook URL" name="webhook_url" placeholder="https://sistema.com/api/cobranca/webhook" />

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setOpen(false)}
                  style={secondaryButtonStyle}
                  type="button"
                >
                  Cancelar
                </button>
                <button style={primaryButtonStyle} type="submit">
                  Cadastrar programa
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Field(props: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label style={{ display: "grid", gap: 5, fontSize: 13, minWidth: 0, color: "#57534e" }}>
      <span>{props.label}</span>
      <input
        name={props.name}
        placeholder={props.placeholder}
        type={props.type ?? "text"}
        style={{
          border: "1px solid #d6d3d1",
          borderRadius: 6,
          boxSizing: "border-box",
          font: "inherit",
          padding: "9px 10px",
          width: "100%"
        }}
      />
    </label>
  );
}

const primaryButtonStyle = {
  background: "#1c1917",
  border: 0,
  borderRadius: 6,
  color: "white",
  cursor: "pointer",
  font: "inherit",
  padding: "10px 14px"
};

const secondaryButtonStyle = {
  background: "#f5f5f4",
  border: "1px solid #d6d3d1",
  borderRadius: 6,
  color: "#292524",
  cursor: "pointer",
  font: "inherit",
  padding: "10px 14px"
};
