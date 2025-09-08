# 📊 DIAGNÓSTICO - SISTEMA DE TRADING USDCOP

## 📁 Estructura del Proyecto

Este directorio contiene una copia organizada de todos los archivos críticos del sistema de visualización y trading USDCOP para fines de diagnóstico y análisis.

## 🗂️ Organización de Carpetas

### 01_CONFIGURATION
Archivos de configuración del sistema:
- `env.local` - Variables de entorno locales
- `env.example` - Plantilla de variables de entorno
- `next.config.ts` - Configuración de Next.js
- `package.json` - Dependencias del proyecto
- `tsconfig.json` - Configuración de TypeScript

### 02_FRONTEND
Componentes de la interfaz de usuario:

#### `/pages`
- `page.tsx` - Página principal del dashboard
- `layout.tsx` - Layout principal de la aplicación

#### `/components/charts`
- `InteractiveTradingChart.tsx` - Gráfico principal de trading
- `LightweightChart.tsx` - Versión ligera del gráfico
- `OptimizedChart.tsx` - Gráfico optimizado para grandes datasets
- `CanvasChart.tsx` - Renderizado con Canvas API
- `InteractiveChart.tsx` - Gráfico interactivo base

#### `/components/controls`
- `ReplayControls.tsx` - Controles de reproducción histórica

#### `/components/views`
- `EnhancedTradingDashboard.tsx` - Dashboard principal mejorado
- `RealTimeChart.tsx` - Visualización en tiempo real
- `L5ModelDashboard.tsx` - Dashboard del modelo L5
- `BacktestResults.tsx` - Resultados de backtesting

### 03_BACKEND
APIs y endpoints del sistema:

#### `/api/data`
- `/realtime` - Endpoint de datos en tiempo real
- `/align` - Alineación de datasets
- `/historical` - Datos históricos
- `/cached` - Datos en caché
- `/gaps` - Relleno de gaps
- `/l0, l1, l3, l5` - Endpoints de pipeline por nivel
- `/verify` - Verificación de datos

#### `/api/market`
- `/health` - Estado del mercado
- `/realtime` - Streaming de mercado

#### `/api/pipeline`
- `/l0` - Pipeline nivel 0

### 04_SERVICES
Servicios y lógica de negocio:

#### `/market`
- `market-replay.ts` - Servicio de replay histórico
- `market-data-service.ts` - Servicio principal de datos de mercado

#### `/data`
- `data-alignment.ts` - Alineación de datasets
- `websocket-manager.ts` - Gestión de WebSockets

#### `/integrations`
- `minio-client.ts` - Cliente MinIO
- `twelvedata.ts` - Integración TwelveData
- `api-key-rotation.ts` - Rotación de API keys

### 05_UTILITIES
Utilidades y funciones auxiliares:
- `utils.ts` - Utilidades generales
- `trading-hours.ts` - Gestión de horarios de trading
- `useExport.ts` - Hook de exportación
- `useRealtimeData.ts` - Hook de datos en tiempo real

### 06_DOCUMENTATION
Documentación adicional y guías

## 🔍 Propósito del Diagnóstico

Esta estructura permite:
1. **Análisis rápido** de la arquitectura del sistema
2. **Identificación** de dependencias críticas
3. **Debugging** sin afectar el código en producción
4. **Documentación** de la estructura actual
5. **Auditoría** de seguridad y configuración

## 🚀 Servicios Activos

- **Dashboard**: http://localhost:3000
- **MinIO**: http://localhost:9001
- **MLflow**: http://localhost:5000
- **Airflow**: http://localhost:8081

## 📝 Notas

- Esta es una copia estática para diagnóstico
- Los archivos originales permanecen en su ubicación original
- Actualizado: ${new Date().toISOString()}