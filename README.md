# Extractor automático de publicaciones de X

Este repositorio ejecuta un navegador automático en GitHub Actions. Abre perfiles públicos de X,
hace desplazamiento, conserva publicaciones propias dentro del periodo solicitado y genera CSV,
Excel, PDF, HTML y JSON.

No necesitas instalar Python, Node.js ni Playwright en tu computadora.

## Crear el repositorio

1. Entra a `https://github.com/new`.
2. En **Repository name** escribe `extractor-publicaciones-x`.
3. Selecciona **Public**.
4. No marques las opciones para crear README, `.gitignore` o licencia.
5. Pulsa **Create repository**.
6. Descomprime el ZIP de este proyecto en tu computadora.
7. En GitHub pulsa **uploading an existing file**.
8. Arrastra la carpeta `.github`, la carpeta `scraper` y este archivo `README.md`.
9. Pulsa **Commit changes**.

Si macOS oculta la carpeta `.github`, pulsa `Command + Shift + .` para mostrar archivos ocultos.

## Ejecutar una extracción

1. Abre la pestaña **Actions** del repositorio.
2. Si GitHub lo solicita, pulsa **I understand my workflows, go ahead and enable them**.
3. Selecciona **Extraer publicaciones de X**.
4. Pulsa **Run workflow**.
5. Completa los campos:
   - **perfiles:** uno o varios usuarios separados por comas, por ejemplo `TecNM_Tepeaca, cuenta2`.
   - **fecha_desde:** fecha inicial `YYYY-MM-DD`.
   - **fecha_hasta:** fecha final `YYYY-MM-DD`.
   - **maximo:** máximo de publicaciones por cuenta.
6. Pulsa el botón verde **Run workflow**.
7. Espera a que la ejecución termine.
8. Abre la ejecución y descarga `reporte-x-N` en la sección **Artifacts**.

## Archivos generados

- `publicaciones_*.csv`: matriz con las seis columnas institucionales.
- `dependencia_*.xlsx`: detalle y resumen de publicaciones.
- `reporte_*.pdf`: reporte ejecutivo.
- `reporte_*.html`: versión imprimible.
- `datos_*.json`: respaldo estructurado.
- `resumen_ejecucion.json`: cuentas completadas y errores encontrados.

## Reglas

- Incluye publicaciones propias.
- Excluye respuestas y reposts.
- Ordena desde la publicación más antigua hasta la más reciente.
- Usa la zona horaria `America/Mexico_City`.
- Clasifica formato, origen, proyecto y bloque operativo.
- Admite hasta 20 perfiles por ejecución.

## Limitación de X

El programa consulta únicamente información que X presenta públicamente. No evita inicios de sesión,
captchas ni bloqueos. Si X exige autenticación al navegador de GitHub, la ejecución indicará qué cuenta
no pudo completarse; en ese caso será necesario utilizar el extractor de Chrome con una sesión abierta.

