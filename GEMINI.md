# Reglas Visuales Obligatorias del Proyecto (Estándar Taste-Skill)

Toda modificación de interfaz de usuario (UI/UX), páginas, componentes, diálogos, tablas, formularios, alertas y métricas en este repositorio **DEBE** cumplir estrictamente con [REGLAS_VISUALES.md](./REGLAS_VISUALES.md), integrando los principios anti-slop y micro-interacciones de **Taste-Skill** (`.agents/skills/design-taste-frontend/`).

Antes de crear o editar cualquier componente visual:
1. Consulta `REGLAS_VISUALES.md` y verifica cada sección.
2. **Lienzo abierto, cero tarjetas cerradas**: Prohibido envolver secciones, KPIs, formularios o listas en recuadros cerrados (`Card`, `border rounded-lg`, `border rounded-xl`, `shadow-sm`). Usa divisores sutiles (`border-b border-neutral-100`, `border-b border-neutral-200/60`, `divide-y divide-neutral-100` o gradientes tenues).
3. **Botones limpios y micro-interacciones**: Prohibido botones con bordes, sombras o pastillas/fondos sólidos (`bg-white`, `bg-neutral-100`, `border`). Usa botones *icon-only* (`text-neutral-400 hover:text-neutral-900`) o texto limpio (`text-xs text-neutral-500 hover:text-neutral-900`). Aplica siempre la micro-interacción de presión `active:scale-[0.985]` con transiciones suaves en `150ms`.
4. **Selectores e inputs**: Prohibido `<select>` / `<option>` nativos e inputs en caja (`border rounded-md`). Usa [`CustomDropdown`](components/ui/custom-dropdown.tsx) e inputs con línea base inferior (`bg-transparent border-b border-neutral-200 focus:border-neutral-900 py-1.5 outline-none`).
5. **Acciones en tablas y filas**: Prohibido `Trash2`. Usa `PenLine` (`strokeWidth={1.25}`) para editar y `X` (`strokeWidth={1.5}`) para eliminar/descartar, revelados en `group-hover`.
6. **Alertas y confirmaciones**: Prohibido banners en bloque con fondos de color (`bg-emerald-50`, `bg-red-50`, `bg-amber-50`) y prohibición absoluta de `window.confirm()`, `window.alert()` y `window.prompt()`. Usa feedback neutro en línea y [`DeleteConfirmDialog`](components/ui/delete-confirm-dialog.tsx) (o modales integrados con `backdrop-blur-xs`).
7. **Tipografía, medidas y métricas**: Prohibido `uppercase` y prohibido iconos decorativos junto a títulos de métricas (salvo solicitud explícita). Usa Sentence case natural, tipografía pura, medida de lectura máxima de 62 caracteres (`measure-copy`) y cifras en `font-mono tabular-nums`.
8. **Imágenes y fotografías reales**: Marcos limpios con `overflow-hidden` y micro-zoom sutil (`group-hover:scale-[1.025] duration-500`).


