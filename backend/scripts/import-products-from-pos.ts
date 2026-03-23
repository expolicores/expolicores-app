// backend/src/scripts/import-products-from-pos.ts
//
// Script para importar / actualizar productos desde un CSV exportado del POS,
// hospedado en Cloudflare R2 y servido por el CDN: https://cdn.expressapp.net
//
// Estructura propuesta en el bucket expolicores-feed:
//
//   products/pos-products.csv              <-- CSV del POS
//   products/images/7701234567890.webp    <-- imágenes por código de barras
//
// - Usa "barcode" como clave de negocio para hacer UPSERT.
// - Calcula price y b2bPrice en centavos (Int).
// - Construye imageUrl basado en el barcode: products/images/{barcode}.webp
//
// REQUISITOS:
// - Node 18+ (para usar fetch nativo).
// - Variable de entorno POS_PRODUCTS_CSV_URL apuntando al CSV en R2,
//   por ejemplo: POS_PRODUCTS_CSV_URL="https://cdn.expressapp.net/products/pos-products.csv"
//
// EJEMPLO DE USO (staging / producción):
//   POS_PRODUCTS_CSV_URL="https://cdn.expressapp.net/products/pos-products.csv" \
//   DATABASE_URL="postgres://..." \
//   npx ts-node src/scripts/import-products-from-pos.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------- CONFIGURACIÓN BÁSICA ----------

// URL del CSV en R2, viene del .env
const CSV_URL = process.env.POS_PRODUCTS_CSV_URL;

// Delimitador del CSV: ";" o ","
const CSV_DELIMITER = ';';

// Prefijo de imágenes dentro del bucket expolicores-feed.
// Esto se guardará en product.imageUrl, y el frontend lo resolverá como:
//   https://cdn.expressapp.net/<imageUrl>
// Ej: imageUrl = "products/images/7701234567890.webp"
const IMAGE_BASE_PATH = 'products/images';
const IMAGE_EXTENSION = 'webp';

// Si el CSV tiene encabezado en la primera fila
const HAS_HEADER_ROW = true;

// ---------- HELPERS ----------

type CsvRow = Record<string, string>;

function parseCsvHeader(line: string): string[] {
  return line.split(CSV_DELIMITER).map((h) => h.trim());
}

function parseCsvLine(line: string, headers: string[]): CsvRow {
  const values = line.split(CSV_DELIMITER);
  const row: CsvRow = {};

  headers.forEach((header, index) => {
    row[header] = (values[index] ?? '').trim();
  });

  return row;
}

function getFirstNonEmpty(row: CsvRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Convierte string de precio en COP a centavos (Int).
 * Acepta formatos como "12500", "12.500", "12,500.00", "12500,5", etc.
 */
function parsePriceToCents(raw?: string): number {
  if (!raw) return 0;
  let s = raw.trim();

  // Eliminar separadores de miles comunes
  s = s.replace(/\./g, '').replace(/,/g, '.');

  const num = Number(s);
  if (Number.isNaN(num) || num <= 0) return 0;

  return Math.round(num * 100);
}

/**
 * Construye el path relativo de la imagen basado en el código de barras.
 * Ej: barcode = "7701234567890" => "products/images/7701234567890.webp"
 */
function buildImagePath(barcode?: string): string | null {
  if (!barcode) return null;
  return `${IMAGE_BASE_PATH}/${barcode}.${IMAGE_EXTENSION}`;
}

// ---------- SCRIPT PRINCIPAL ----------

async function main() {
  console.log('Iniciando importación de productos desde POS (CSV en R2/CDN)...');

  if (!CSV_URL) {
    console.error(
      'ERROR: No se encontró la variable de entorno POS_PRODUCTS_CSV_URL.\n' +
        'Configúrala con la URL del CSV en R2, por ejemplo:\n' +
        'POS_PRODUCTS_CSV_URL="https://cdn.expressapp.net/products/pos-products.csv"',
    );
    process.exit(1);
  }

  console.log('Descargando CSV desde:', CSV_URL);

  const res = await fetch(CSV_URL);
  if (!res.ok) {
    console.error('ERROR al descargar el CSV:', res.status, res.statusText);
    process.exit(1);
  }

  const csvText = await res.text();
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    console.error('El CSV está vacío.');
    process.exit(1);
  }

  let headers: string[] = [];
  let startIndex = 0;

  if (HAS_HEADER_ROW) {
    headers = parseCsvHeader(lines[0]);
    startIndex = 1;
    console.log('Encabezados detectados:', headers);
  } else {
    const parts = lines[0].split(CSV_DELIMITER);
    headers = parts.map((_, idx) => `col${idx}`);
    startIndex = 0;
    console.log('Encabezados generados:', headers);
  }

  let processed = 0;
  let skipped = 0;

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const row = parseCsvLine(trimmed, headers);

    // --------- MAPEO DE COLUMNAS (AJUSTA A TU CSV DEL POS) ---------
    const name =
      getFirstNonEmpty(row, ['name', 'Name', 'NOMBRE', 'descripcion']) ?? '';
    const barcode = getFirstNonEmpty(row, [
      'barcode',
      'Barcode',
      'CODIGO_BARRAS',
      'COD_BARRAS',
      'codigo_barras',
    ]);
    const category =
      getFirstNonEmpty(row, ['category', 'Category', 'CATEGORIA']) ?? null;
    const description =
      getFirstNonEmpty(row, ['description', 'DESCRIPCION', 'detalle']) ??
      name;

    const priceStr =
      getFirstNonEmpty(row, ['price', 'PRICE', 'precio', 'PRECIO']) ?? '0';
    const b2bPriceStr =
      getFirstNonEmpty(row, [
        'b2bPrice',
        'precio_b2b',
        'precio_mayorista',
        'PRECIO_B2B',
      ]) ?? priceStr;

    const stockStr =
      getFirstNonEmpty(row, ['stock', 'STOCK', 'existencia', 'EXISTENCIA']) ??
      '0';

    if (!name) {
      console.warn(`Línea ${i + 1}: sin nombre, se omite.`);
      skipped++;
      continue;
    }

    if (!barcode) {
      console.warn(`Línea ${i + 1}: sin código de barras, se omite.`);
      skipped++;
      continue;
    }

    const priceInCents = parsePriceToCents(priceStr);
    const b2bPriceInCents = parsePriceToCents(b2bPriceStr);

    const stock = Number(stockStr.replace(/\./g, '').replace(/,/g, '')) || 0;

    const imageUrl = buildImagePath(barcode);

    // --------- UPSERT EN PRODUCT ---------
    try {
      await prisma.product.upsert({
        where: { barcode }, // requiere barcode @unique en el modelo
        create: {
          name,
          barcode,
          category,
          description,
          price: priceInCents,
          b2bPrice: b2bPriceInCents,
          stock,
          imageUrl,
        },
        update: {
          name,
          category,
          description,
          price: priceInCents,
          b2bPrice: b2bPriceInCents,
          stock,
          imageUrl,
        },
      });

      processed++;
      if (processed % 100 === 0) {
        console.log(
          `Productos procesados: ${processed} (omitidos: ${skipped})`,
        );
      }
    } catch (e) {
      console.error(
        `Error al procesar línea ${i + 1} con barcode ${barcode}:`,
        e,
      );
      skipped++;
    }
  }

  console.log(
    `\nImportación finalizada. Productos procesados: ${processed}. Omitidos: ${skipped}.`,
  );
}

main()
  .catch((err) => {
    console.error('Error fatal en el importador:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
