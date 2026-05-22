import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store";

/** Round-trip probe for the tracer-bullet slice: invoke the Rust `ping` command. */
function usePing() {
  return useQuery({
    queryKey: ["ping"],
    queryFn: () => invoke<string>("ping"),
  });
}

function App() {
  const ping = usePing();
  const { dark, toggleDark } = useUiStore();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Marrow Symphony</h1>
        <p className="text-muted-foreground text-sm">
          Scaffold slice — proving the React → Tauri → Rust spine.
        </p>
      </header>

      <section className="bg-card text-card-foreground flex w-full max-w-md flex-col gap-3 rounded-xl border p-6 shadow-sm">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Backend IPC probe
        </div>
        <code className="bg-muted rounded-md px-3 py-2 font-mono text-sm break-words">
          {ping.isPending && "pinging…"}
          {ping.isError && `error: ${String(ping.error)}`}
          {ping.data}
        </code>
        <div className="flex gap-2">
          <Button onClick={() => ping.refetch()} disabled={ping.isFetching}>
            {ping.isFetching ? "Pinging…" : "Ping again"}
          </Button>
          <Button variant="outline" onClick={toggleDark}>
            {dark ? <Sun /> : <Moon />}
            {dark ? "Light" : "Dark"}
          </Button>
        </div>
      </section>
    </main>
  );
}

export default App;
