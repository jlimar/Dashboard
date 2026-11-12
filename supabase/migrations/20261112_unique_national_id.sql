-- Migración: Normalizar cédulas y crear restricción UNIQUE para evitar duplicados
-- Fecha: 2026-11-12

-- 1. Normalizar formato estándar de cédulas (V-XXXXXXXX o E-XXXXXXXX)
UPDATE public.profiles
SET national_id = 
    CASE 
        WHEN upper(trim(national_id)) LIKE 'E%' THEN 'E-' || regexp_replace(national_id, '[^0-9]', '', 'g')
        ELSE 'V-' || regexp_replace(national_id, '[^0-9]', '', 'g')
    END
WHERE national_id IS NOT NULL AND national_id != '';

-- 2. Crear índice único sobre los dígitos de la cédula para prevenir físicamente duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_unique_clean_national_id 
ON public.profiles (regexp_replace(upper(national_id), '[^0-9]', '', 'g'))
WHERE national_id IS NOT NULL AND national_id != '';

