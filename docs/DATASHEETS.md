# Fichas Técnicas PDF — ElektrK

Guía completa para subir, asignar y verificar fichas técnicas (datasheets) de producto desde Payload Admin.

---

## 1. Cómo subir un PDF desde Payload Admin

1. Entra a `/admin` e inicia sesión como administrador.
2. En el menú lateral, ve a **Contenido → Archivos (Media)**.
3. Haz clic en **Crear nuevo archivo**.
4. Sube el PDF de la ficha técnica.
5. Completa los campos:
   - **Texto alternativo (alt):** Deja vacío (no aplica para PDFs).
   - **Descripción / pie de foto:** Opcional. Ej. _"Ficha técnica Siemens 5SL6110-7"_.
   - **Tipo de archivo:** Selecciona **"Ficha técnica / Datasheet (PDF)"** ← **obligatorio**.
6. Guarda el archivo.

> **Importante:** El campo **Tipo de archivo** debe ser `datasheet` para que el PDF aparezca en el selector de fichas técnicas dentro del formulario de producto.

---

## 2. Cómo asignarlo a un producto

1. Ve a **Catálogo → Productos** y abre el producto correspondiente.
2. Selecciona la pestaña **Media**.
3. En el campo **Ficha técnica (PDF)**, haz clic en **Seleccionar relación**.
4. El selector ya viene filtrado para mostrar solo archivos con `documentType: datasheet`. Busca y selecciona el PDF que subiste.
5. Guarda el producto.

---

## 3. Cómo probarlo en `/products/[slug]`

1. Abre la página del producto en el storefront (`/products/<slug-del-producto>`).
2. Debajo de la imagen del producto aparecerá el botón:
   - ✅ **"Descargar ficha técnica"** — si el producto tiene un PDF asignado.
   - ⬜ **"Ficha técnica no disponible"** (deshabilitado) — si el producto no tiene datasheet.
3. Al hacer clic en el botón, el PDF se abre en una nueva pestaña o se descarga (según la configuración del navegador).

---

## 4. Validación de tipo de archivo

El botón de ficha técnica sólo se activa cuando se cumple **al menos una** de estas condiciones:

| Condición | Cuándo aplica |
|-----------|---------------|
| `mimeType === "application/pdf"` | Media poblado desde Payload con `depth ≥ 1` |
| La URL termina en `.pdf` | Datos mock o Payload con `depth=0` |

Si un archivo no cumple ninguna condición (p. ej. una imagen asignada accidentalmente), el botón muestra **"Ficha técnica no disponible"** y no genera un enlace roto.

---

## 5. Qué hacer si el producto no muestra la ficha técnica

### Checklist de diagnóstico

- [ ] **¿El archivo tiene `documentType: datasheet`?**
  Ve a Media en el admin y verifica el campo "Tipo de archivo". Si dice "Imagen de producto" u otro valor, cámbialo a "Ficha técnica / Datasheet (PDF)".

- [ ] **¿El producto tiene el PDF asignado en el campo "Ficha técnica (PDF)"?**
  Abre el producto → pestaña Media → verifica que el campo no esté vacío.

- [ ] **¿El archivo subido es realmente un PDF?**
  Payload solo permite MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`, `application/pdf`. Si el archivo no es un PDF válido, Payload rechazará la subida.

- [ ] **¿El `DATA_SOURCE` es `"payload"`?**
  Con `DATA_SOURCE="mock"`, el storefront usa datos de prueba (`src/data/mock-products.ts`) que tienen URLs de ejemplo (`/datasheets/*.pdf`). Los archivos mock no existen en disco — solo sirven para desarrollo. Para ver datasheets reales, asegúrate de que `.env.local` tenga `DATA_SOURCE="payload"`.

- [ ] **¿El servidor está en modo desarrollo (`bun dev`)?**
  Los archivos subidos a Media se guardan en `public/media/`. Asegúrate de que el archivo físico exista ahí. En producción, configura un bucket S3 o Cloudflare R2 en Payload para almacenamiento persistente.

---

## 6. Flujo técnico (para desarrolladores)

```
Payload Admin
  └─ Media.documentType = "datasheet"
  └─ Media.mimeType     = "application/pdf"
  └─ Media.url          = "/media/nombre-archivo.pdf"

Products.datasheet  →  relationship → media
  (filterOptions: { documentType: { equals: "datasheet" } })

getProductBySlug()
  └─ payload.find({ depth: 1 })  →  populates datasheet
  └─ mapPayloadProduct()
       └─ resolveMediaDoc(p.datasheet)
            └─ { url, filename, mimeType }
  └─ Product.datasheetUrl      = "/media/nombre-archivo.pdf"
  └─ Product.datasheetFilename = "nombre-archivo.pdf"
  └─ Product.datasheetMimeType = "application/pdf"

/products/[slug]/page.tsx
  └─ <DatasheetButton
        url={product.datasheetUrl}
        filename={product.datasheetFilename}
        mimeType={product.datasheetMimeType}
        productName={product.name}
     />

DatasheetButton
  └─ isPdf(url, mimeType) → true
  └─ Renders <a href="/media/..." target="_blank" download="nombre-archivo.pdf">
```

---

## 7. Archivos relevantes

| Archivo | Rol |
|---------|-----|
| `src/collections/Media.ts` | Define Media collection — mimeTypes permitidos, campo `documentType` |
| `src/collections/Products.ts` | Campo `datasheet` con `filterOptions: { documentType: { equals: "datasheet" } }` |
| `src/lib/mappers/product.mapper.ts` | `resolveMediaDoc()` → extrae `url`, `filename`, `mimeType` |
| `src/types/product.ts` | `Product.datasheetUrl`, `datasheetFilename`, `datasheetMimeType` |
| `src/components/shared/DatasheetButton.tsx` | UI: botón PDF con validación, aria-label y nombre de descarga |
| `src/app/(store)/products/[slug]/page.tsx` | Renderiza `<DatasheetButton>` con todos los props |
