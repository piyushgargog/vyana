import { hello } from "@vyana/shared";

// Placeholder. Arvind replaces this in A1.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-16">
      <h1 className="text-4xl font-semibold">Vyana · व्यान</h1>
      <p className="text-zinc-500">The breath that reaches every corner.</p>
      <p className="text-xs text-zinc-400">shared: {hello}</p>
    </main>
  );
}
