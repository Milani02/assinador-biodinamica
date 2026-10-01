import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";

const DOCUMENTOS_BUCKET = "documentos";
const PROTOCOLOS_BUCKET = "protocolos";
const SIGNED_URL_TTL_SECONDS = 300;

export async function saveUploadedFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex");
  const ext = path.extname(file.name) || ".pdf";
  const subdir = new Date().toISOString().slice(0, 7); // YYYY-MM
  const relativePath = `${subdir}/${randomUUID()}${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .upload(relativePath, buffer, { contentType: "application/pdf" });
  if (error) throw new Error(`Falha ao enviar arquivo: ${error.message}`);

  return { relativePath, sha256Hash: hash, originalName: file.name };
}

export async function saveAvulsoFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex");
  const ext = path.extname(file.name) || ".pdf";
  const subdir = new Date().toISOString().slice(0, 7); // YYYY-MM
  const relativePath = `avulsos/${subdir}/${randomUUID()}${ext}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .upload(relativePath, buffer, { contentType: "application/pdf" });
  if (error) throw new Error(`Falha ao enviar arquivo: ${error.message}`);

  return { relativePath, sha256Hash: hash, originalName: file.name };
}

export async function getAvulsoBytes(relativePath: string): Promise<Uint8Array> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(DOCUMENTOS_BUCKET).download(relativePath);
  if (error || !data) throw new Error("Não foi possível ler o arquivo original.");
  return new Uint8Array(await data.arrayBuffer());
}

export async function getAvulsoSignedUrl(relativePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .createSignedUrl(relativePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error("Não foi possível gerar link do arquivo.");
  return data.signedUrl;
}

export async function getDocumentoSignedUrl(relativePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTOS_BUCKET)
    .createSignedUrl(relativePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error("Não foi possível gerar link do arquivo.");
  return data.signedUrl;
}

export async function saveProtocolFile(filename: string, bytes: Uint8Array) {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(PROTOCOLOS_BUCKET)
    .upload(filename, bytes, { contentType: "application/pdf" });
  if (error) throw new Error(`Falha ao salvar protocolo: ${error.message}`);
  return filename;
}

export async function getProtocoloSignedUrl(relativePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(PROTOCOLOS_BUCKET)
    .createSignedUrl(relativePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error("Não foi possível gerar link do protocolo.");
  return data.signedUrl;
}
