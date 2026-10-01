"use client";

import { EmbedSignDocument } from "@documenso/embed-react";

export function EmbedSigning({
  token,
  onCompleted,
}: {
  token: string;
  onCompleted: () => void;
}) {
  return (
    <div className="h-[calc(100vh-140px)] min-h-[720px] w-full overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-foreground/10">
      <EmbedSignDocument
        token={token}
        host={process.env.NEXT_PUBLIC_DOCUMENSO_URL}
        onDocumentCompleted={onCompleted}
        className="h-full w-full border-0"
      />
    </div>
  );
}
