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

const readErrorMessage = async (response: Response) => {
  const data = await response.json().catch(() => null);
  if (data && typeof data === "object") {
    if ("details" in data && typeof data.details === "string") return data.details;
    if ("error" in data && typeof data.error === "string") return data.error;
  }
  return `Errore ${response.status}`;
};

const uploadWithApiFallback = async ({ id, sedeId, data, tipo, file }: UploadParams) => {
  const formData = new FormData();
  formData.append("sedeId", sedeId);
  formData.append("data", data);
  formData.append("tipo", tipo);
  formData.append("file", file, file.name);

  const response = await fetch(`/api/cassa-files/${encodeURIComponent(id)}`, {
    method: "POST",
    body: formData,
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

  try {
    const signResponse = await fetch(`/api/cassa-files/${encodeURIComponent(id)}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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

    const supabaseBody = new FormData();
    supabaseBody.append("cacheControl", "3600");
    supabaseBody.append("", file);

    const uploadResponse = await fetch(signData.signedUrl, {
      method: "PUT",
      headers: { "x-upsert": "true" },
      body: supabaseBody,
    });

    if (!uploadResponse.ok) {
      throw new Error(await uploadResponse.text());
    }

    const completeResponse = await fetch(`/api/cassa-files/${encodeURIComponent(id)}/complete`, {
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
    return await uploadWithApiFallback(params);
  } catch (err) {
    const fallbackError = err instanceof Error ? err.message : "Upload fallback non riuscito.";
    throw new Error(`${fallbackError}${directUploadError ? ` (${directUploadError})` : ""}`);
  }
}
