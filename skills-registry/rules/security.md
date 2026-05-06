---
trigger: always_on
---

Cuando generes o modifiques código frontend, aplica estas reglas de seguridad:

# Reglas de Seguridad Frontend

## Objetivo

Prevenir vulnerabilidades de seguridad en aplicaciones frontend. Estas reglas aplican a TODO código generado, sin excepción.

---

## 1. Prohibiciones absolutas (CRITICAL)

- **NUNCA** usar `eval()`, `new Function()`, `document.write()`, o `setTimeout/setInterval` con strings.
- **NUNCA** usar `dangerouslySetInnerHTML` (React) o `bypassSecurityTrust*` (Angular) sin sanitización previa con DOMPurify.
- **NUNCA** usar `innerHTML` con contenido dinámico sin sanitizar.
- **NUNCA** almacenar tokens de autenticación en `localStorage` o `sessionStorage`.
- **NUNCA** incluir API keys secretas, contraseñas, o connection strings en el código frontend.
- **NUNCA** usar prefijos que exponen variables al browser (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`) para secretos.
- **NUNCA** crear endpoints o Server Actions sin autenticación y validación de input.

---

## 2. Obligaciones (HIGH)

- **SIEMPRE** validar inputs con Zod o equivalente antes de enviar al servidor.
- **SIEMPRE** validar URLs antes de usarlas en `href` o redirecciones — bloquear `javascript:` protocol.
- **SIEMPRE** usar `rel="noopener noreferrer"` en links con `target="_blank"`.
- **SIEMPRE** usar HTTPS para todas las comunicaciones con APIs.
- **SIEMPRE** verificar `origin` en handlers de `window.postMessage`.
- **SIEMPRE** sanitizar mensajes de error — nunca exponer detalles internos al usuario.
- **SIEMPRE** aplicar autenticación + autorización en BACKEND además de guards/middleware del frontend.

---

## 3. Tokens y autenticación

- Preferir HttpOnly cookies para auth tokens (el frontend nunca toca el token).
- Si se maneja token en memoria (SPA), implementar refresh automático y limpieza en logout.
- Logout debe: limpiar memoria + invalidar sesión en servidor + redirigir con navegación completa.

---

## 4. Headers de seguridad

Todo proyecto en producción debe configurar:
- `Content-Security-Policy` (sin `unsafe-eval`)
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 5. Dependencias

- Usar versiones exactas o lock files (commit `package-lock.json`).
- Scripts externos deben usar Subresource Integrity (SRI).
- `console.log` debe eliminarse en builds de producción.
