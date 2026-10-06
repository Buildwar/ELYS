# ⚡ ELYS — ADVANCED TASK SCHEDULER

![ELYS Header](https://img.shields.io/badge/ELYS-Task%20Scheduler-00f0ff?style=for-the-badge&logo=electron&logoColor=black)
![Architecture](https://img.shields.io/badge/Architecture-Node.js%20%2B%20React%2019-00ff9d?style=for-the-badge)
![Security](https://img.shields.io/badge/Security-AES--256--GCM%20%7C%20RBAC%20%7C%20SSRF--Protected-ff0055?style=for-the-badge)
![Portainer](https://img.shields.io/badge/Deploy-Portainer%20Ready-38bdf8?style=for-the-badge&logo=portainer)
![License](https://img.shields.io/badge/Developer-Adri%C3%A1n%20Palma-ff007f?style=for-the-badge)

**ELYS** es un programador y orquestador centralizado de tareas automatizadas (*Advanced Task Scheduler*) diseñado para ejecutar, monitorizar y auditar comandos (PowerShell, Bash, CMD) y peticiones HTTP/Webhooks en infraestructuras heterogéneas (Windows Server, Windows Desktop, Linux, BSD y host local).

Su filosofía fundamental es **"Simple por defecto, potente cuando lo necesitas"**: una interfaz limpia, intuitiva y rápida para operadores cotidianos, que esconde bajo demanda capacidades avanzadas de concurrencia, reintentos con backoff exponencial, secretos cifrados, dependencias entre tareas y control de misfire.

---

## 🎯 ¿Qué es y qué NO es ELYS?

### ELYS ES:
- **Centro de Control Centralizado**: Programar y ejecutar tareas remotas (SSH, WinRM, Local) o peticiones HTTP/Webhooks.
- **Divulgación Progresiva**: Creación guiada en 3 pasos simples, con pestañas técnicas avanzadas accesibles al instante.
- **Motor Asíncrono Robusto**: Control estricto de timeouts, políticas de concurrencia (`allow`, `block`, `queue`, `replace`), reintentos automáticos y auditoría completa.
- **Seguridad Interna y Hardening**: Cifrado en reposo AES-256-GCM para credenciales, protección contra SSRF en webhooks, tokens JWT con revocación inmediata y rate limiting.
- **Persistencia Confiable**: Base de datos SQLite en modo WAL, volumen desacoplado y exportación/importación JSON.

### ELYS NO ES:
- NO es un sistema de monitorización ni observabilidad (no recoge métricas de CPU/RAM/Disco de servidores).
- NO es un SIEM, NOC ni sustituto de Zabbix, PRTG, Prometheus o Grafana.

---

## 🚀 Características Principales

1. **Dashboard de Operaciones**:
   - Resumen en tiempo real del estado del scheduler, tareas activas, pausadas y ejecuciones en curso.
   - Línea temporal de próximas ejecuciones programadas y ejecuciones recientes.
   - Botón de pausa/reanudación global del motor.

2. **Gestión de Tareas (Simple por Defecto, Potente cuando se Necesita)**:
   - **Modo Básico**: Flujo vertical en 3 pasos: *¿Qué hace?*, *¿Dónde se ejecuta?* y *¿Cuándo se ejecuta?*.
   - **Modo Avanzado**: Dependencias en grafo acíclico (DAG), variables secretas interpoladas en tiempo de ejecución, concurrencia, políticas de misfire y notificaciones (Telegram y SMTP).
   - Acciones masivas (activar, pausar, ejecutar, mover a papelera, etiquetar).

3. **Destinos e Infraestructura por Sistema Operativo**:
   - Clasificación jerárquica de servidores por SO: *Windows Server*, *Windows Desktop*, *Linux*, *BSD* y *Otros*.
   - Comprobación de conectividad TCP real en tiempo real (WinRM 5985/5986, SSH 22) con diagnóstico de latencia en milisegundos.

4. **Almacén Seguro de Credenciales**:
   - Soporte para WinRM (contraseña / dominio), SSH (contraseña o llave privada RSA/Ed25519) y tokens.
   - Secretos cifrados con AES-256-GCM.

5. **Instalación Limpia y Configuración Inicial Asistida**:
   - En despliegues nuevos, ELYS detecta que la base de datos está vacía y lanza el asistente de configuración inicial para crear el primer usuario Administrador.
   - Sin datos ficticios, sin tareas demo y sin servidores simulados.

---

## 🚢 Despliegue con Portainer (Recomendado)

ELYS está preparado para desplegarse directamente desde Portainer utilizando el repositorio oficial de GitHub y la imagen en GitHub Container Registry (`ghcr.io`).

### Pasos de Despliegue en Portainer:

1. Inicia sesión en tu panel de **Portainer**.
2. En el menú lateral, dirígete a **Stacks** y haz clic en **Add stack**.
3. Asigna un nombre al stack (por ejemplo: `elys`).
4. En el método de compilación, selecciona **Repository**.
5. Introduce la URL oficial del repositorio:
   ```text
   https://github.com/adrianpalma360-create/ELYS.git
   ```
6. En **Repository reference**, especifica: `refs/heads/main` (o deja en blanco para la rama por defecto).
7. En **Compose path**, indica:
   ```text
   docker-compose.portainer.yml
   ```
8. En la sección **Environment variables**, define las variables de producción:
   - `JWT_SECRET`: Clave aleatoria robusta para firma de tokens (ej: generada con `openssl rand -hex 32`).
   - `ENCRYPTION_KEY`: Clave de cifrado maestro para credenciales (opcional; si se omite, se deriva con seguridad de `JWT_SECRET`).
   - `PORT`: `4800` (puerto por defecto).
   - `TZ`: Tu zona horaria (ej: `Europe/Madrid`, `UTC`, `America/New_York`).
9. Haz clic en **Deploy the stack**.
10. Una vez desplegado, accede desde tu navegador a:
    ```
    http://IP_DEL_SERVIDOR:4800
    ```

---

## 🐳 Despliegue Local con Docker Compose

Si prefieres ejecutar ELYS localmente mediante Docker:

1. Clona el repositorio oficial:
   ```bash
   git clone https://github.com/adrianpalma360-create/ELYS.git
   cd ELYS
   ```

2. Copia y edita las variables de entorno:
   ```bash
   cp .env.example .env
   ```

3. Inicia el contenedor con Docker Compose:
   ```bash
   docker compose up -d --build
   ```

4. Abre en tu navegador:
   ```
   http://localhost:4800
   ```

---

## ⚙️ Variables de Entorno

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `PORT` | Puerto de escucha del servidor | `4800` |
| `NODE_ENV` | Entorno de ejecución (`production` / `development`) | `production` |
| `DATA_DIR` | Directorio para la base de datos persistente SQLite | `/data` |
| `JWT_SECRET` | Clave secreta para tokens JWT | *(Obligatoria en producción)* |
| `ENCRYPTION_KEY` | Clave secreta para cifrado AES-256-GCM | *(Derivada si se omite)* |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos (separados por coma) | `http://localhost:4800` |
| `TZ` | Zona horaria del sistema y scheduler | `UTC` |

---

## 💾 Persistencia de Datos y Backups

ELYS almacena la base de datos SQLite (en modo WAL), registros y configuraciones en el volumen persistente:
```text
elys_data:/data
```

### Para realizar un backup manual de los datos:
```bash
docker run --rm -v elys_data:/data -v $(pwd):/backup alpine tar czf /backup/elys-backup-$(date +%Y%m%d).tar.gz -C /data .
```

Al actualizar el contenedor con una nueva versión de la imagen, el volumen `elys_data` conserva todos los usuarios, tareas, destinos, credenciales e historial de ejecuciones.

---

## 🛠️ Desarrollo Local

### Requisitos:
- Node.js 20+ y npm 10+

```bash
# 1. Instalar dependencias
npm install
npm --prefix client install

# 2. Ejecutar entorno de desarrollo (Backend :4800 + Frontend Vite :5173)
npm run dev

# 3. Compilar para producción
npm run build

# 4. Ejecutar tests de seguridad y robustez
npm test
```

---

## 📄 Licencia y Autoría

Desarrollado y mantenido por **Adrián Palma**.
Repositorio Oficial: [https://github.com/adrianpalma360-create/ELYS](https://github.com/adrianpalma360-create/ELYS)
