import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Admin from "@/pages/Admin";
import { CassaMobileUpload } from "@/pages/CassaMobileUpload";

const queryClient = new QueryClient();

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Errore applicazione",
    };
  }

  componentDidCatch(error: unknown) {
    console.error("Errore runtime applicazione", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-background px-4 py-10 text-foreground">
        <div className="mx-auto max-w-lg rounded-md border border-destructive/30 bg-destructive/10 p-5">
          <h1 className="text-lg font-semibold text-destructive">Errore di caricamento</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Il gestionale ha ricevuto dati non validi o una risposta API inattesa.
          </p>
          <p className="mt-3 rounded bg-white/70 px-3 py-2 text-xs text-muted-foreground">
            {this.state.message}
          </p>
          <button
            type="button"
            className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            onClick={() => {
              try {
                sessionStorage.removeItem("operator_role");
              } catch {
                // Ignore storage failures and reload anyway.
              }
              window.location.assign("/admin");
            }}
          >
            Torna al login
          </button>
        </div>
      </div>
    );
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={Admin} />
      <Route path="/cassa-camera" component={CassaMobileUpload} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppErrorBoundary>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AppErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
