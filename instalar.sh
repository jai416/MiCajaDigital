#!/bin/bash
echo "=== Instalando dependencias de Mi Caja Digital ==="
echo ""

# Check for npm/node
if ! command -v npm &> /dev/null; then
  echo "ERROR: npm no encontrado. Instala Node.js primero."
  exit 1
fi

echo "Node: $(node --version)"
echo "npm: $(npm --version)"
echo ""

# Clean
rm -rf node_modules package-lock.json

# Install with retry logic
MAX_RETRIES=3
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
  echo "Intento $((RETRY+1)) de $MAX_RETRIES..."
  npm install --no-audit --no-fund
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Instalación completada."
    echo "Para iniciar: npx expo start"
    exit 0
  fi
  RETRY=$((RETRY+1))
  if [ $RETRY -lt $MAX_RETRIES ]; then
    echo "Reintentando en 3 segundos..."
    sleep 3
  fi
done

echo "ERROR: No se pudo instalar. Verifica tu conexión a internet."
exit 1
