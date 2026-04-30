export default function NovaPropostaLoading() {
  return (
    <main className="flex min-h-[50vh] flex-col items-center justify-center gap-2 bg-surface-100 px-4 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" aria-hidden />
      <p className="text-sm font-medium text-surface-700">A abrir formulario…</p>
      <p className="max-w-sm text-xs text-surface-500">O ID e criado quando clicar em Iniciar.</p>
    </main>
  );
}
