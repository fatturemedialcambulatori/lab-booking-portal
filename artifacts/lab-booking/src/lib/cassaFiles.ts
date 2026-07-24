export type CassaDocumentUploadResult = {
  id: string;
  data: string;
  sedeId: "modena" | "sassuolo" | string;
  tipo: "fatturato" | "pos" | string;
  bucket?: string;
  storagePath?: string;
  fileName: string;
  fileUrl: string;
  contentType?: string;
  sizeBytes?: number;
  uploadedAt: string;
};

type UploadParams = {
  id: string;
  sedeId: string;
  data: string;
  tipo: string;
  file: File;
};

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const apiUrl = (path: string) => new URL(path, window.location.origin).toString();

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Lettura file non riuscita."));
    reader.readAsDataURL(file);
  });

const readErrorMessage = async (response: Response) => {
  const data = await response.json().catch(() => null);
  if (data && typeof data === "object") {
    if ("details" in data && typeof data.details === "string") return data.details;
    if ("error" in data && typeof data.error === "string") return data.error;
  }
  return `Errore ${response.status}`;
};

const uploadWithJsonFallback = async ({ id, sedeId, data, tipo, file }: UploadParams) => {
  const response = await fetch(apiUrl("/api/cassa-file-upload"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentId: id,
      sedeId,
      data,
      tipo,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      fileBase64: await fileToDataUrl(file),
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.json() as Promise<CassaDocumentUploadResult>;
};

export async function uploadCassaDocument(params: UploadParams) {
  const { id, sedeId, data, tipo, file } = params;

  if (file.size > MAX_FILE_BYTES) {
    throw new Error("File troppo grande: sul piano Free il limite e 50 MB per file.");
  }

  let directUploadError = "";
  let jsonUploadError = "";

  try {
    const signResponse = await fetch(apiUrl("/api/cassa-file-sign"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: id,
        sedeId,
        data,
        tipo,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      }),
    });

    if (!signResponse.ok) {
      throw new Error(await readErrorMessage(signResponse));
    }

    const signData = await signResponse.json() as {
      signedUrl?: string;
      document?: CassaDocumentUploadResult;
    };

    if (!signData.signedUrl || !signData.document) {
      throw new Error("Link firmato Supabase non valido.");
    }

    const uploadResponse = await fetch(signData.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(await uploadResponse.text());
    }

    const completeResponse = await fetch(apiUrl("/api/cassa-file-complete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signData.document),
    });

    if (!completeResponse.ok) {
      throw new Error(await readErrorMessage(completeResponse));
    }

    return completeResponse.json() as Promise<CassaDocumentUploadResult>;
  } catch (err) {
    directUploadError = err instanceof Error ? err.message : "Upload diretto non riuscito.";
  }

  try {
    return await uploadWithJsonFallback(params);
  } catch (err) {
    jsonUploadError = err instanceof Error ? err.message : "Upload JSON non riuscito.";
  }

  const details = [directUploadError, jsonUploadError].filter(Boolean).join(" / ");
  throw new Error(details || "Upload documento cassa non riuscito.");
}
