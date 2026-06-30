export default function HomePage() {
  return (
    <main style={{ fontFamily: "Georgia, serif", padding: 32 }}>
      <h1>Nuvem Local Cobranca</h1>
      <p>Gateway de cobranca pronto para rodar na Vercel.</p>
      <p>Endpoints iniciais:</p>
      <ul>
        <li>`POST /api/billings`</li>
        <li>`POST /api/webhooks/asaas`</li>
        <li>`GET /api/health`</li>
      </ul>
    </main>
  );
}
