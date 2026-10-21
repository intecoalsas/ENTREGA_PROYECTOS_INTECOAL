import uuid
from datetime import datetime, timezone, timedelta, date



def _solo_fecha(valor):
    if not valor:
        return None
    if isinstance(valor, datetime):
        if valor.tzinfo is not None:
            return valor.astimezone(timezone.utc).date()
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str):
        try:
            dt = datetime.fromisoformat(valor.replace("Z", "+00:00"))
            if dt.tzinfo is not None:
                return dt.astimezone(timezone.utc).date()
            return dt.date()
        except ValueError:
            pass
        try:
            return datetime.strptime(valor[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def es_dia_habil(fecha):
    return fecha.weekday() < 5


def sumar_dias_habiles(fecha, n):
    d = fecha
    c = 0
    while c < n:
        d += timedelta(days=1)
        if es_dia_habil(d):
            c += 1
    return d


def retroceder_dias_habiles(fecha, n):
    d = fecha
    c = 0
    while c < n:
        d -= timedelta(days=1)
        if es_dia_habil(d):
            c += 1
    return d


def dias_habiles_entre(desde, hasta):
    c = 0
    d = desde
    while d < hasta:
        d += timedelta(days=1)
        if es_dia_habil(d):
            c += 1
    return c


def fecha_limite_revision(fecha_radicacion_iso):
    f = _solo_fecha(fecha_radicacion_iso)
    if not f:
        return None
    return sumar_dias_habiles(f, 15)


def dias_habiles_restantes(fecha_limite, hoy=None):
    return dias_restantes(fecha_limite, hoy)


def dias_restantes(fecha_limite, hoy=None):
    hoy = hoy or datetime.now(timezone.utc).date()
    if not fecha_limite:
        return None
    return (fecha_limite - hoy).days


def fecha_en_que_faltan(fecha_limite, n):
    return fecha_limite - timedelta(days=n)


def estado_semaforo(restantes, aprobado=False):
    if aprobado:
        return "verde"
    if restantes is None:
        return "gris"
    if restantes < 0:
        return "morado"
    if restantes <= 4:
        return "rojo"
    if restantes <= 8:
        return "amarillo"
    return "azul"


CATALOGO_21_DOCUMENTOS = [
    {
        "id": 1, "code": "A1", "name": "Diseño fotométrico aprobado",
        "category": "diseno", "categoryName": "Documentos de Diseño",
        "required": True, "folderGroup": "A_Tecnicos",
        "description": "Estudio y simulación de niveles de iluminancia y uniformidad según RETILAP."
    },
    {
        "id": 2, "code": "A2", "name": "Cédula de ciudadanía del diseñador",
        "category": "diseno", "categoryName": "Documentos de Diseño",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Copia legible de la cédula del ingeniero diseñador responsable."
    },
    {
        "id": 3, "code": "A3", "name": "Tarjeta profesional del diseñador",
        "category": "diseno", "categoryName": "Documentos de Diseño",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Matrícula o tarjeta profesional vigente expedida por la autoridad competente (COPNIA)."
    },
    {
        "id": 4, "code": "A4", "name": "Diploma RETILAP del diseñador",
        "category": "diseno", "categoryName": "Documentos de Diseño",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Acreditación académica en diplomado o capacitación sobre norma RETILAP."
    },
    {
        "id": 5, "code": "A5", "name": "Plano Asbuilt georreferenciado y firmado",
        "category": "diseno", "categoryName": "Documentos de Diseño",
        "required": True, "folderGroup": "A_Tecnicos",
        "description": "Planos finales de construcción en coordenadas reales firmados por diseñador y constructor."
    },
    {
        "id": 6, "code": "A6", "name": "Memoria descriptiva del proyecto",
        "category": "diseno", "categoryName": "Documentos de Diseño",
        "required": True, "folderGroup": "A_Tecnicos",
        "description": "Documento técnico con detalles constructivos, cálculos eléctricos y alcance técnico."
    },
    {
        "id": 7, "code": "A7", "name": "Declaración de cumplimiento RETILAP del diseñador",
        "category": "diseno", "categoryName": "Documentos de Diseño",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Conforme al formato 4.3.7.A del RETILAP. Formato oficial de declaración firmada por el diseñador eléctrico."
    },
    {
        "id": 8, "code": "B8", "name": "Carta de garantía de luminarias",
        "category": "luminarias", "categoryName": "Luminarias y Materiales",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Garantía del fabricante por vida útil, fotometría y hermeticidad de luminarias."
    },
    {
        "id": 9, "code": "B9", "name": "Certificado de producto — Cable",
        "category": "luminarias", "categoryName": "Luminarias y Materiales",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Certificado de conformidad RETIE/RETILAP de los conductores eléctricos."
    },
    {
        "id": 10, "code": "B10", "name": "Certificado de producto — Fotocelda",
        "category": "luminarias", "categoryName": "Luminarias y Materiales",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Certificado RETILAP del elemento de control fotoeléctrico."
    },
    {
        "id": 11, "code": "B11", "name": "Certificado de producto — Brazo",
        "category": "luminarias", "categoryName": "Luminarias y Materiales",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Certificación mecánica y anticorrosiva de los soportes metálicos."
    },
    {
        "id": 12, "code": "B12", "name": "Certificado de producto — Herrajes",
        "category": "luminarias", "categoryName": "Luminarias y Materiales",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Certificados de conformidad de herrajes y accesorios de fijación."
    },
    {
        "id": 13, "code": "B13", "name": "Certificado de producto — Conectores",
        "category": "luminarias", "categoryName": "Luminarias y Materiales",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Certificados de conectores."
    },
    {
        "id": 14, "code": "B14", "name": "Certificado de producto — Postes",
        "category": "luminarias", "categoryName": "Luminarias y Materiales",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Certificación de postes de concreto o metálicos (si aplica en el alcance)."
    },
    {
        "id": 15, "code": "C15", "name": "Cédula de ciudadanía del constructor",
        "category": "constructor", "categoryName": "Documentos del Constructor",
        "required": True, "folderGroup": "C_Contractuales",
        "description": "Documento de identidad del ingeniero residente o director de obra."
    },
    {
        "id": 16, "code": "C16", "name": "Matrícula profesional del constructor",
        "category": "constructor", "categoryName": "Documentos del Constructor",
        "required": True, "folderGroup": "C_Contractuales",
        "description": "Matrícula profesional de la persona a cargo del montaje e instalación."
    },
    {
        "id": 17, "code": "C17", "name": "Diploma RETILAP del constructor",
        "category": "constructor", "categoryName": "Documentos del Constructor",
        "required": True, "folderGroup": "C_Contractuales",
        "description": "Certificado de capacitación RETILAP del responsable de construcción."
    },
    {
        "id": 18, "code": "C18", "name": "Declaración de cumplimiento RETIE y RETILAP del constructor",
        "category": "constructor", "categoryName": "Documentos del Constructor",
        "required": True, "folderGroup": "B_Certificaciones",
        "description": "Conforme al formato 4.3.7.B del RETILAP y formato 4.3.6.2 del RETIE. Formato de declaración juramentada de la correcta ejecución de la obra."
    },
    {
        "id": 19, "code": "D19", "name": "Dictamen RETIE",
        "category": "dictamenes", "categoryName": "Dictámenes y Permisos",
        "required": False,
        "folderGroup": "D_Inventario",
        "description": "Dictamen de inspección de organismo acreditado ONAC: para proyectos exclusivos de AP."
    },
    {
        "id": 20, "code": "D20", "name": "Dictamen RETILAP",
        "category": "dictamenes", "categoryName": "Dictámenes y Permisos",
        "required": True, "requiredIfCategoriaBc": True,
        "folderGroup": "D_Inventario",
        "description": "Dictamen final de inspección de alumbrado público por organismo de tercera parte."
    },
    {
        "id": 21, "code": "D21", "name": "Recibo de vías por parte del Municipio",
        "category": "dictamenes", "categoryName": "Dictámenes y Permisos",
        "required": True, "folderGroup": "D_Inventario",
        "description": "Paz y salvo o recibo oficial de intervención de espacio público emitido por la alcaldía."
    },
    {
        "id": 22, "code": "CAUE", "name": "CAUE — Costo Anual Uniforme Equivalente",
        "category": "otros", "categoryName": "Otros",
        "required": True, "folderGroup": "E_Otros",
        "description": "Estudio financiero del costo anual uniforme equivalente del proyecto."
    },
    {
        "id": 23, "code": "CANT", "name": "Archivo de cantidades de infraestructura a entregar",
        "category": "otros", "categoryName": "Otros",
        "required": True, "folderGroup": "E_Otros",
        "description": "Cantidades de la construcción que se pretende entregar para el Alumbrado Público."
    },
    {
        "id": 24, "code": "CVP", "name": "Certificado de vía pública",
        "category": "otros", "categoryName": "Otros",
        "required": True, "folderGroup": "E_Otros",
        "description": "Certificado de vía pública de Secretaría de Planeación."
    },
    {
        "id": 25, "code": "CEAP", "name": "Documentos para circuitos exclusivos de AP",
        "category": "otros", "categoryName": "Otros",
        "required": True, "folderGroup": "E_Otros",
        "description": "Adicionar para cuando existan circuitos exclusivos de Alumbrado Público.",
        "hasSubFiles": True,
        "subFiles": [
            {"subId": "25a", "subCode": "CEAP-A", "subName": "Tarjeta profesional del diseñador y constructor"},
            {"subId": "25b", "subCode": "CEAP-B", "subName": "Cédula del diseñador y constructor"},
            {"subId": "25c", "subCode": "CEAP-C", "subName": "Memoria de cálculo"},
            {"subId": "25d", "subCode": "CEAP-D", "subName": "Plano eléctrico"}
        ]
    },
]

ESTADOS = [
    "Radicado",
    "Aprobado",
    "Con Observaciones",
]

GRUPOS_CARPETA = {
    "A_Tecnicos": "Documentos Técnicos de Diseño",
    "B_Certificaciones": "Certificaciones y Luminarias",
    "C_Contractuales": "Documentación Contractual",
    "D_Inventario": "Dictámenes e Inventario",
    "E_Otros": "Otros documentos",
    "F_Documentos_Adicionales": "Documentos adicionales",
}


def generar_numero_radicado(radicaciones_existentes=None):
    year = datetime.now().year
    max_consecutivo = 0
    existentes = set()

    if radicaciones_existentes:
        for r in radicaciones_existentes:
            num = r.get("numeroRadicado", "")
            if num.startswith(f"RAD-{year}-"):
                existentes.add(num)
                try:
                    consecutivo = int(num.split("-")[-1])
                    if consecutivo > max_consecutivo:
                        max_consecutivo = consecutivo
                except ValueError:
                    pass

    nuevo_consecutivo = max_consecutivo + 1
    numero = f"RAD-{year}-{nuevo_consecutivo:03d}"

    while numero in existentes:
        nuevo_consecutivo += 1
        numero = f"RAD-{year}-{nuevo_consecutivo:03d}"

    return numero


def generar_id():
    return str(uuid.uuid4())[:8]


def calcular_porcentaje(archivos):
    total = len(archivos) if archivos else len(CATALOGO_21_DOCUMENTOS)
    validos = sum(1 for a in archivos if a.get("status") in ("CUMPLE", "N/A"))
    return round((validos / total) * 100) if total > 0 else 0
