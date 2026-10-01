"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
      <p className="max-w-md text-muted-foreground">
        Ocorreu um erro inesperado. Tente novamente ou volte para o painel.
      </p>
      <div className="flex gap-3">
        <Button onClick={() => reset()} variant="outline">
          Tentar novamente
        </Button>
        <Button render={<Link href="/" />} nativeButton={false}>
          Voltar ao painel
        </Button>
      </div>
    </div>
  );
}
