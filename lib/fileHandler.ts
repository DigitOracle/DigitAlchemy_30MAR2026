// lib/fileHandler.ts
// Server-side file parsing — never pass filenames only to LLM

import type { ParsedFileContent } from "@/types"

const MAX_TEXT_LENGTH = 8000  // chars to pass to LLM

export async function parseUploadedFile(
  file: File
): Promise<ParsedFileContent> {
  const name = file.name
  const sizeByes = file.size
  const mimeType = file.type || inferMimeType(name)

  // IFC files — extract metadata
  if (name.endsWith(".ifc")) {
    const text = await file.text()
    const metadata = extractIfcMetadata(text)
    return {
      originalName: name,
      mimeType: "application/x-step",
      sizeByes,
      contentType: "ifc-metadata",
      extractedText: summariseIfcText(text),
      metadata,
    }
  }

  // Text-based files
  if (
    mimeType.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv")
  ) {
    const text = await file.text()
    return {
      originalName: name,
      mimeType,
      sizeByes,
      contentType: "text",
      extractedText: text.slice(0, MAX_TEXT_LENGTH),
      metadata: { truncated: text.length > MAX_TEXT_LENGTH, originalLength: text.length },
    }
  }

  // JSON files
  if (name.endsWith(".json") || name.endsWith(".geojson") || name.endsWith(".dtdl")) {
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      return {
        originalName: name,
        mimeType: "application/json",
        sizeByes,
        contentType: "structured",
        extractedText: JSON.stringify(parsed, null, 2).slice(0, MAX_TEXT_LENGTH),
        metadata: {
          keys: typeof parsed === "object" ? Object.keys(parsed) : [],
          type: Array.isArray(parsed) ? "array" : "object",
          length: Array.isArray(parsed) ? parsed.length : undefined,
        },
      }
    } catch {
      return binaryFallback(name, mimeType, sizeByes)
    }
  }

  // Images — pass as binary with metadata only (LLM vision handled separately)
  if (mimeType.startsWith("image/")) {
    return {
      originalName: name,
      mimeType,
      sizeByes,
      contentType: "image",
      metadata: { note: "Image uploaded — pass to vision model separately" },
    }
  }

  // Binary files (PDF, DOCX, RVT, NWD, DWG) — metadata only
  // These need server-side parsing via markdownify/ifcmcp
  return binaryFallback(name, mimeType, sizeByes)
}

function binaryFallback(name: string, mimeType: string, sizeByes: number): ParsedFileContent {
  return {
    originalName: name,
    mimeType,
    sizeByes,
    contentType: "binary",
    metadata: {
      note: "Binary file — requires server-side parsing via markdownify or ifcmcp",
      extension: name.split(".").pop() ?? "unknown",
    },
  }
}

function inferMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ifc: "application/x-step",
    rvt: "application/octet-stream",
    dwg: "application/acad",
    nwd: "application/octet-stream",
    geojson: "application/geo+json",
    kml: "application/vnd.google-earth.kml+xml",
    shp: "application/octet-stream",
  }
  return mimeMap[ext] ?? "application/octet-stream"
}

function extractIfcMetadata(text: string): Record<string, unknown> {
  const lines = text.split("\n").slice(0, 200)
  const schema = lines.find((l) => l.includes("FILE_SCHEMA"))?.match(/'([^']+)'/)?.[1] ?? "unknown"
  const description = lines.find((l) => l.includes("FILE_DESCRIPTION"))?.slice(0, 200) ?? ""
  const entityCount = (text.match(/^#\d+=/gm) ?? []).length

  const typeCounts: Record<string, number> = {}
  const typeMatches = text.matchAll(/= (IFC[A-Z]+)\(/g)
  for (const match of typeMatches) {
    typeCounts[match[1]] = (typeCounts[match[1]] ?? 0) + 1
  }

  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => ({ type, count }))

  return { schema, description, entityCount, topTypes }
}

function summariseIfcText(text: string): string {
  const lines = text.split("\n").slice(0, 100)
  return lines.join("\n").slice(0, MAX_TEXT_LENGTH)
}

export function parsedFileToContextString(file: ParsedFileContent): string {
  const lines = [
    `File: ${file.originalName} (${(file.sizeByes / 1024).toFixed(1)} KB, ${file.mimeType})`,
  ]

  if (file.contentType === "ifc-metadata" && file.metadata) {
    const m = file.metadata as Record<string, unknown>
    lines.push(`IFC Schema: ${m.schema}`)
    lines.push(`Total entities: ${m.entityCount}`)
    if (Array.isArray(m.topTypes)) {
      lines.push(`Top element types: ${(m.topTypes as {type:string;count:number}[]).map(t => `${t.type}(${t.count})`).join(", ")}`)
    }
  }

  if (file.extractedText) {
    lines.push(`\nExtracted content:\n${file.extractedText}`)
  }

  if (file.contentType === "binary") {
    lines.push(`Note: Binary file — server-side parsing required for full extraction.`)
  }

  return lines.join("\n")
}
