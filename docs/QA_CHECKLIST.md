# QA Checklist — ElektrK

> Checklist completo de pruebas para validar el storefront antes y después del deploy.  
> Marca cada ítem con ✅ (OK), ❌ (fallo) o ⏭️ (no aplica aún).

---

## 1. Home (`/`)

- [ ] Carga sin errores de consola
- [ ] Sección hero visible con CTA al catálogo
- [ ] Productos destacados (featured) visibles
- [ ] Links de productos llevan a `/products/[slug]` correcto
- [ ] CTA "Ver catálogo" lleva a `/products`
- [ ] Dark mode aplica correctamente en todos los elementos
- [ ] Responsive: mobile (375px), tablet (768px), desktop (1280px)

---

## 2. Catálogo (`/products`)

- [ ] Grid de productos carga correctamente
- [ ] Skeleton de carga aparece mientras se obtienen datos
- [ ] Todos los productos tienen imagen, nombre y precio
- [ ] Paginación o scroll funcionan (si aplica)
- [ ] Estado vacío si no hay productos: mensaje apropiado
- [ ] Dark mode aplica en filtros y tarjetas
- [ ] Responsive: sidebar en desktop, colapsado en mobile

---

## 3. Filtros

- [ ] Filtro por marca funciona
- [ ] Filtro por amperaje funciona
- [ ] Filtro por polos funciona
- [ ] Filtro por voltaje funciona
- [ ] Filtro por curva de disparo funciona
- [ ] Combinación de múltiples filtros funciona
- [ ] "Limpiar filtros" resetea todos los filtros
- [ ] Filtros activos se reflejan en la URL (query params)
- [ ] Recargar página con filtros activos mantiene el estado

---

## 4. Búsqueda

- [ ] Campo de búsqueda filtra por nombre de producto
- [ ] Búsqueda no es case-sensitive
- [ ] Búsqueda vacía muestra todos los productos
- [ ] Sin resultados muestra estado vacío apropiado
- [ ] Búsqueda combinada con filtros funciona

---

## 5. Detalle de producto (`/products/[slug]`)

- [ ] Carga para todos los slugs generados estáticamente
- [ ] Nombre, descripción, precio visible
- [ ] Imagen del producto visible
- [ ] Selector de variantes funciona (polos, amperaje, etc.)
- [ ] Precio cambia al seleccionar variante (si aplica)
- [ ] Botón "Añadir al carrito" funciona
- [ ] Cantidad mínima 1, botón de reducir deshabilitado en 1
- [ ] Aria labels en botones de cantidad (accesibilidad)
- [ ] Slug inexistente → redirige a 404

---

## 6. Datasheets / PDFs

- [ ] Enlace de datasheet visible si el producto tiene PDF
- [ ] PDF abre en nueva pestaña
- [ ] Sin datasheet: enlace no visible o correctamente deshabilitado

---

## 7. Carrito

### Cajón (CartDrawer)

- [ ] Se abre al hacer clic en ícono de carrito
- [ ] Lista los productos añadidos con nombre, variante y precio
- [ ] Subtotal calculado correctamente
- [ ] Envío mostrado correctamente (tarifa plana)
- [ ] Total = subtotal + envío
- [ ] Aumentar cantidad actualiza total
- [ ] Reducir cantidad actualiza total
- [ ] Eliminar ítem con aria-label correcto (`Eliminar [nombre]`)
- [ ] Carrito vacío muestra estado vacío con CTA a catálogo
- [ ] Badge en navbar muestra cantidad correcta
- [ ] Badge desaparece cuando carrito está vacío
- [ ] "Ir al checkout" navega a `/checkout`

### Página de carrito (`/cart`)

- [ ] Misma lógica que cajón (revisión secundaria)
- [ ] CTA de checkout funcional

---

## 8. Checkout

### Modo mock (actual)

- [ ] Formulario carga con campos: nombre, email, dirección, ciudad, código postal, teléfono
- [ ] Validaciones de campos requeridos funcionan
- [ ] Resumen del pedido visible (productos, subtotal, envío, total)
- [ ] Enviar formulario muestra estado de carga
- [ ] Simulación exitosa → redirige a `/checkout/success`
- [ ] Banner de "⚠️ Modo simulado" visible
- [ ] Mensajes de error con `role="alert"` (accesibilidad)

### Modo Stripe real (Phase 7B — futuro)

- [ ] `STRIPE_SECRET_KEY` configurado
- [ ] Checkout session creada correctamente
- [ ] Redirige a Stripe Checkout
- [ ] Tarjeta de prueba `4242 4242 4242 4242` completa el pago
- [ ] Webhook recibido y procesado
- [ ] Orden creada en Payload
- [ ] `/checkout/success` muestra confirmación real

---

## 9. Stripe

- [ ] `/api/checkout/session` devuelve 503 si `STRIPE_SECRET_KEY` no está configurado
- [ ] `/api/stripe/webhook` devuelve 400 sin header `Stripe-Signature`
- [ ] `/api/stripe/webhook` devuelve 400 con firma inválida
- [ ] Webhook procesa `checkout.session.completed` sin errores
- [ ] No se imprimen valores de keys en logs

---

## 10. Auth / Login / Register

### Login (`/login`)

- [ ] Formulario carga correctamente
- [ ] Validación de email requerido
- [ ] Validación de contraseña requerida
- [ ] Error con `role="alert"` cuando DB no está configurada
- [ ] Sin DB: muestra mensaje amigable (no stack trace)
- [ ] Con DB: credenciales incorrectas muestran error
- [ ] Con DB: login exitoso redirige a `/account`
- [ ] Enlace a `/register` funcional
- [ ] Botones OAuth ocultos si no hay credenciales configuradas

### Register (`/register`)

- [ ] Formulario: nombre, apellido, email, contraseña, confirmar contraseña
- [ ] Validación de campos requeridos
- [ ] Error si contraseñas no coinciden
- [ ] Error con `role="status"` en éxito, `role="alert"` en error
- [ ] Sin DB: mensaje amigable de servicio no disponible
- [ ] Con DB: registro crea usuario

---

## 11. Account (`/account`)

- [ ] Sin sesión: redirige a login
- [ ] Con sesión (JWT mock): muestra nombre y email del usuario
- [ ] Stats: total órdenes, tickets abiertos, total gastado
- [ ] Lista de órdenes recientes
- [ ] Links de órdenes llevan a `/account/orders/[id]`
- [ ] Botón de cerrar sesión funciona
- [ ] Skeleton de carga durante fetch

---

## 12. Orders

### Lista (`/account/orders`)

- [ ] Sin sesión: redirige a login
- [ ] Lista órdenes con fecha, estado y total
- [ ] Badges de estado con colores correctos (fulfilled=verde, paid=azul, cancelled=rojo, etc.)
- [ ] Link a detalle por orden funcional
- [ ] Sin órdenes: estado vacío con CTA

### Detalle (`/account/orders/[id]`)

- [ ] Carga datos de la orden correcta
- [ ] Muestra ítems con nombre, cantidad, precio unitario, subtotal de línea
- [ ] Muestra dirección de envío
- [ ] Muestra totales (subtotal + envío + total)
- [ ] ID de orden inexistente → 404 personalizado
- [ ] Notas de la orden visibles si existen

---

## 13. Tickets / Soporte (`/support/tickets`)

- [ ] Formulario: asunto, mensaje, prioridad
- [ ] Validaciones de campos requeridos
- [ ] Asunto máx. 200 caracteres
- [ ] Mensaje máx. 2000 caracteres
- [ ] Enviar ticket crea registro mock
- [ ] Lista de tickets visible tras crear
- [ ] Filtros por estado (abierto, en progreso, resuelto) funcionan
- [ ] Estado vacío si no hay tickets

---

## 14. Payload Admin (`/admin`)

- [ ] Accesible en modo payload (DATA_SOURCE=payload)
- [ ] Login de Payload funciona
- [ ] Colección de productos visible
- [ ] Crear producto con todos los campos requeridos
- [ ] Publicar / despublicar producto
- [ ] Colección de media funciona (upload de imágenes y PDFs)
- [ ] En modo mock: `/admin` redirige o muestra Payload UI en modo standalone (sin DB activa)

---

## 15. Media / PDFs

- [ ] Imágenes de productos cargan desde Payload media (modo payload) o rutas estáticas (mock)
- [ ] PDFs de datasheets accesibles y descargables
- [ ] Imágenes con `alt` text correcto
- [ ] No hay imágenes rotas en ninguna página

---

## 16. Dark Mode

- [ ] Toggle visible en navbar (desktop y mobile)
- [ ] Cambia entre claro y oscuro sin recarga
- [ ] Preferencia persiste en localStorage
- [ ] Todos los textos legibles en ambos modos
- [ ] Bordes, fondos y sombras correctos en ambos modos
- [ ] Formularios, inputs y botones correctos en ambos modos
- [ ] Badges de estado correctos en ambos modos

---

## 17. Responsive (Mobile / Tablet / Desktop)

### Mobile (375px — iPhone SE)

- [ ] Navbar colapsa a menú hamburguesa
- [ ] Menú móvil abre/cierra correctamente
- [ ] Cajón de carrito ocupa ancho completo
- [ ] Grids de 1 columna en catálogo y home
- [ ] Formularios legibles y usables con teclado virtual
- [ ] Botones con tamaño táctil suficiente (≥ 44px)

### Tablet (768px — iPad)

- [ ] Navbar puede mostrar links en línea o colapsar (según diseño)
- [ ] Grids de 2 columnas
- [ ] Sidebar de filtros visible o colapsado

### Desktop (1280px+)

- [ ] Navbar completo con todos los links
- [ ] Sidebar de filtros fija o scrollable
- [ ] Grid de 3-4 columnas en catálogo
- [ ] Cajón de carrito con ancho fijo (no full-width)

---

## 18. SEO

- [ ] `<title>` correcto en cada página
- [ ] `<meta name="description">` presente en páginas principales
- [ ] OG tags (`og:title`, `og:description`, `og:image`) en home y producto
- [ ] `og:image` resuelve a una URL absoluta (requiere `NEXT_PUBLIC_SERVER_URL`)
- [ ] Páginas privadas tienen `noindex` (account, orders, checkout, cart, login, register, admin)
- [ ] `metadataBase` configurado en root layout

---

## 19. Sitemap (`/sitemap.xml`)

- [ ] Accesible en producción
- [ ] Incluye `/`, `/products`, `/support`
- [ ] Incluye todos los slugs de productos
- [ ] NO incluye `/account`, `/cart`, `/checkout`, `/admin`, `/api`, `/support/tickets`
- [ ] URLs son absolutas y usan el dominio correcto

---

## 20. Robots (`/robots.txt`)

- [ ] Accesible en producción
- [ ] `Allow` en páginas públicas
- [ ] `Disallow` en páginas privadas (`/account`, `/cart`, `/checkout`, `/admin`, `/api/`, `/login`, `/register`, `/support/tickets`)
- [ ] `Sitemap:` apunta a la URL correcta

---

## 21. Página 404

- [ ] Ruta inexistente muestra `not-found.tsx` personalizado
- [ ] Botón "Ir al inicio" funciona
- [ ] Botón "Ver catálogo" funciona
- [ ] Logo de marca visible
- [ ] Tiene `noindex` en metadata

---

## 22. Accesibilidad

- [ ] Todos los botones tienen `aria-label` descriptivo
- [ ] Íconos decorativos tienen `aria-hidden="true"`
- [ ] Mensajes de error tienen `role="alert"`
- [ ] Mensajes de éxito tienen `role="status"`
- [ ] Cantidades en carrito tienen `aria-live="polite"`
- [ ] Imágenes tienen texto alternativo descriptivo
- [ ] Contraste de color suficiente en texto (WCAG AA)
- [ ] Navegación por teclado funcional en todos los formularios
- [ ] Focus visible en elementos interactivos
- [ ] Orden de tabulación lógico

---

## 23. Performance

- [ ] Lighthouse Performance ≥ 80 en mobile
- [ ] Largest Contentful Paint (LCP) < 2.5s
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] No hay importaciones de módulos enormes innecesarios en el bundle del cliente
- [ ] Imágenes con `next/image` y tamaños correctos
- [ ] Fonts cargados con `next/font` (si aplica)
- [ ] Páginas estáticas (SSG) generadas en build (`○` en output de Vercel)

---

## 24. Seguridad básica

- [ ] No se imprimen variables de entorno en logs del servidor
- [ ] No se exponen keys o secrets en respuestas de API
- [ ] Headers de seguridad configurados (Content-Security-Policy, X-Frame-Options, etc.) — verificar en Vercel
- [ ] `/api/stripe/webhook` rechaza requests sin firma válida
- [ ] Rutas de cuenta redirigen a login si no hay sesión
- [ ] Payload admin requiere autenticación
- [ ] No hay archivos `.env` o `.env.local` subidos al repositorio

---

## 25. Variables de entorno

- [ ] `DATA_SOURCE` configurado correctamente (`mock` o `payload`)
- [ ] En modo mock: build funciona sin `DATABASE_URL`
- [ ] En modo payload: `DATABASE_URL` y `PAYLOAD_SECRET` presentes
- [ ] `AUTH_SECRET` y `AUTH_URL` configurados en producción
- [ ] `NEXT_PUBLIC_SERVER_URL` apunta al dominio correcto
- [ ] Variables `NEXT_PUBLIC_*` no contienen secrets (son públicas en el bundle del cliente)

---

## 26. No exposición de secretos

- [ ] `STRIPE_SECRET_KEY` NO visible en source del cliente
- [ ] `DATABASE_URL` NO visible en source del cliente
- [ ] `PAYLOAD_SECRET` NO visible en source del cliente
- [ ] `AUTH_SECRET` NO visible en source del cliente
- [ ] Respuestas de `/api/*` no incluyen stack traces en producción (`NODE_ENV=production`)
- [ ] Logs del servidor no incluyen valores de variables sensibles

---

## Resumen de estado por fase

| Fase | Descripción | Estado |
|---|---|---|
| Storefront mock | Home, catálogo, producto, carrito, checkout simulado | ✅ Listo |
| Auth preparada | Login, register, providers OAuth condicionales | ✅ Preparada (sin DB) |
| Stripe preparado | Cliente, tipos, checkout session, webhook | ✅ Preparado (sin activar) |
| Tickets repository | Mock + repository pattern + mapper | ✅ Listo |
| Orders repository | Mock + repository pattern + mapper | ✅ Listo |
| SEO técnico | Sitemap, robots, not-found, metadataBase | ✅ Listo |
| QA visual | Aria labels, roles, responsive, dark mode | ✅ Auditado |
| Env validation | `src/lib/env.ts` — guards + assert + warn | ✅ Listo |
| Neon conexión | DATABASE_URL, migraciones | ⏳ Pendiente |
| Payload real | DATA_SOURCE=payload, seed | ⏳ Pendiente |
| Stripe real | Pagos reales (Phase 7B) | ⏳ Pendiente |
| Deploy Vercel | Primer deploy a producción | ⏳ Pendiente |
