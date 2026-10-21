
export const MANUAL_META = {
  titulo: 'Manual de Usuario',
  producto: 'Portal de Radicación INTECOAL S.A.S.',
  version: '1.0',
  soporteCorreo: 'coord.tecnico@intecoalsas.com',
  soporteTelefono: '310 355 6449 / (602) 224 8763',
};

export const MANUAL_COMUN = {
  objetivo: [
    'Le enseña a usar el portal paso a paso, sin saber de sistemas.',
    'Aquí solo se explica el portal. Las normas técnicas se las da su ingeniero.',
  ],
  requisitos: [
    'Un computador con internet.',
    'Navegador Chrome o Edge actualizado.',
    'Su correo de Microsoft (si usa Gmail, regístrelo gratis como cuenta Microsoft).',
    'Sus documentos en PDF, foto o plano.',
  ],
  glosario: [
    ['Radicado', 'Su expediente subido al portal. Recibe un número único.'],
    ['N/A', 'Casilla para lo que no aplica a su proyecto.'],
    ['Subsanar', 'Corregir lo que le pidieron, sin cambiar el número.'],
    ['Interventoría', 'El equipo INTECOAL que revisa su expediente.'],
    ['Aprobado', 'Su expediente pasó la revisión.'],
  ],
  interfaz: [
    ['Barra de arriba', 'Logo, su cargo y los botones Manual y Salir.'],
    ['Menú de la izquierda', 'Los botones de cada cosa que puede hacer.'],
    ['Lista principal', 'Sus radicados con su estado y sus botones.'],
    ['Buscador', 'Para encontrar un radicado por número o nombre.'],
  ],
};

export const MANUAL_CONTRATISTA = {
  procedimientos: [
    {
      titulo: 'Subir un proyecto nuevo',
      pasos: [
        'Pulse Nueva Radicación en el menú de la izquierda o en el botón de arriba.',
        'Paso 1: verá la lista de los 25 documentos. Pulse Adjuntar en cada uno y elija el archivo de su computador (PDF, foto o plano).',
        'Si un documento no aplica a su obra (por ejemplo, postes cuando no hay postes), marque la casilla N/A.',
        'Los que dicen OBLIGATORIO deben ir siempre. Si le falta alguno, el sistema le avisa antes de terminar.',
        'Si el documento 25 le aplica, adjunte sus 4 archivos pequeños uno por uno.',
        'Si necesita agregar otro documento que no está en la lista, use Agregar Documento.',
        'Paso 2: escriba los datos del proyecto: nombre, municipio, empresa, NIT, responsable y correo. Revise que el correo esté bien escrito: ahí le llegan los avisos.',
        'Elija el tipo: Inicio si es la primera vez, Subsanación si está corrigiendo.',
        'En el inventario agregue filas con cada luminaria o equipo instalado, su descripción y la cantidad.',
        'Paso 3: revise el resumen (archivos, N/A y pendientes). Ponga su firma: puede dibujarla, escribir su nombre o subir una foto de su firma.',
        'Pulse Radicar y espere el aviso verde con su número de radicado (ej. RAD-2026-023). Anótelo.',
      ],
      nota: 'Puede subirlo incompleto: lo que falte queda para revisión y se lo pedirán después.',
    },
    {
      titulo: 'Ver cómo va mi radicado',
      pasos: [
        'Abra Mis Radicaciones en el menú de la izquierda.',
        'Cada fila muestra número, proyecto, municipio y una etiqueta de estado.',
        'Radicado: ya lo recibimos. En Revisión: lo estamos evaluando, solo espere.',
        'Con Observaciones: debe corregir lo indicado (ver siguiente punto).',
        'Aprobado: pasó la revisión y quedó guardado en SharePoint.',
        'Use el buscador o los filtros (municipio, estado, tipo) para encontrar uno.',
        'Pulse Informe para ver el documento oficial de cada expediente.',
      ],
    },
    {
      titulo: 'Corregir lo que me pidieron',
      pasos: [
        'En el radicado que dice Con Observaciones pulse Editar.',
        'Arriba verá un recuadro azul con todo lo que le pidió la interventoría, punto por punto.',
        'Vuelva a subir solo los documentos señalados. Los que dicen VERIFICADO ya pasaron y no se dejan tocar.',
        'Pulse Guardar y Enviar a Revisión.',
        'Espere el aviso verde de confirmación con el número: el radicado vuelve a En Revisión con el mismo número.',
      ],
      alerta: 'No cierre la ventana mientras diga “Enviando…”. Si algo sale mal, el aviso rojo le dice qué archivo falló y por qué.',
    },
    {
      titulo: 'Borrar un radicado',
      pasos: [
        'Ubique su radicado en la lista.',
        'El botón Borrar solo sale en el último número creado, si es suyo y no está aprobado.',
        'Si otro radicó después, el botón se quita solo de los anteriores.',
        'Confirme. Esto no se puede deshacer.',
      ],
      alerta: 'Lo aprobado nunca se puede borrar.',
    },
  ],
  faq: [
    ['Me pide confirmar con documentos pendientes, ¿qué hago?', 'Es un aviso, no un error. Si le faltan archivos, súbalos; si no los tiene, acepte y continúe: quedarán para revisión.'],
    ['¿Por qué no veo el botón Borrar?', 'Solo sale en el último número, si es suyo y no está aprobado. Si otro radicó después, se quita solo.'],
    ['Un documento dice VERIFICADO y no me deja tocarlo, ¿por qué?', 'Porque ya pasó la revisión. Solo corrija los que dicen Pendiente o No cumple.'],
    ['Sale un mensaje rojo al enviar, ¿qué hago?', 'Lea qué archivo nombra y por qué (tipo o conexión). Corríjalo e intente de nuevo sin salir de la pantalla.'],
    ['Envié y no pasó nada, ¿se guardó?', 'Si no salió el aviso verde, no se envió. Revise si hay un aviso rojo arriba del formulario (la pantalla sube sola hasta él).'],
    ['¿Puedo cambiar mi correo después?', 'No lo haga: todo se guarda con el correo con el que entró. Si entra con otro, sus radicados no aparecen.'],
  ],
  problemas: [
    ['"La firma es obligatoria"', 'Ponga su firma en el Paso 3 antes de radicar.'],
    ['"No se pudo conectar"', 'Revise su internet o espere un minuto si la página está despertando.'],
    ['"Me devolvió al inicio"', 'Se venció el permiso (dura 24 horas). Entre de nuevo.'],
    ['"Me rechaza el archivo"', 'Use PDF, foto o plano.'],
    ['"No veo mis radicados"', 'Verifique que entró con el mismo correo de siempre y quite los filtros de búsqueda.'],
  ],
};

export const MANUAL_REVISOR = {
  procedimientos: [
    {
      titulo: 'Revisar un radicado',
      pasos: [
        'Abra Revisión Radicaciones (ve los de todos los contratistas).',
        'En el expediente pendiente pulse Evaluar.',
        'Abra cada documento con Ver y léalo completo antes de calificar.',
        'Califique uno por uno: Cumple (está bien), Pendiente (falta o no se entiende), No cumple (está mal) o N/A (no aplica).',
        'Califique también cada archivo pequeño (anexos y CEAP) uno por uno con su nota.',
        'En cada observación escriba qué está mal y qué debe volver a subir el contratista, con palabras claras.',
        'Si no termina hoy, use Guardar Avance: guarda el borrador sin avisar a nadie.',
        'Para terminar, elija el resultado (Aprobado o Con Observaciones) y pulse Generar Informe.',
        'Espere el aviso de confirmación antes de salir: el sistema vuelve solo al Historial.',
      ],
      alerta: 'Para dar Aprobado o Con Observaciones necesita su firma puesta. Sin firma no lo deja terminar.',
    },
    {
      titulo: 'Hacer el Formato 4.3.7 C',
      pasos: [
        'En un radicado Aprobado pulse Formato C, o abra el módulo y elija el radicado en la lista.',
        'Pulse Editar y complete los datos. El número, el municipio y la fecha salen solos (la fecha se actualiza cada día hasta subirlo).',
        'Pulse Guardar para dejarlo listo.',
        'Pulse Subir para guardarlo en SharePoint, suelto en la carpeta del radicado.',
        'Use Imprimir si necesita el papel. Ya subido no se puede cambiar.',
      ],
    },
    {
      titulo: 'Hacer el Recibo Técnico',
      pasos: [
        'En un radicado Aprobado pulse Recibo Técnico, o abra el módulo y elija el radicado en la lista.',
        'Pulse Editar y escriba título, persona, asunto y cuerpo. El correo del membrete y la fecha salen solos.',
        'Pulse Guardar y luego Subir para guardarlo en SharePoint.',
        'Use Imprimir si necesita el papel.',
      ],
      nota: 'Ya subido se bloquea y no se puede cambiar.',
    },
    {
      titulo: 'Usar el Calendario',
      pasos: [
        'Abra Calendario en el menú de la izquierda.',
        'Cada radicado tiene 15 días hábiles desde que se creó; el calendario los cuenta solo.',
        'Cada bolita es una fecha clave: azul se creó, amarilla faltan 8 días, roja faltan 4, morada se venció, verde se aprobó.',
        'Pulse una fecha para ver el radicado completo y saltar a Evaluar o al Informe.',
        'A la derecha tiene la lista de próximos a vencer, del más urgente al menos urgente.',
      ],
    },
    {
      titulo: 'Volver a subir a SharePoint',
      pasos: [
        'En un aprobado que diga Pendiente de subida pulse Reintentar subida.',
        'Confirme y espere de 1 a 3 minutos sin cerrar.',
        'Lea el resultado: si dice OK quedó arriba; si falla, el mensaje le dice el motivo (permisos o conexión).',
      ],
      nota: 'A SharePoint solo sube lo aprobado. Los formatos solo suben con su botón Subir.',
    },
  ],
  faq: [
    ['¿Cuándo sube a SharePoint?', 'Solo al aprobar (carpetas + archivos). Los formatos solo con su botón Subir.'],
    ['Un aprobado dice Pendiente de subida, ¿qué hago?', 'Pulse Reintentar subida y lea el motivo si falla.'],
    ['¿Cómo sabe el contratista qué corregir?', 'Con las notas que usted escriba en cada documento y archivo pequeño. Él las ve al corregir.'],
    ['¿A quién le llegan los avisos de fechas?', 'Solo a usted: a los 8 y 4 días, y cada mañana a las 8 si se vence. Al contratista no le llega nada de eso.'],
    ['Guardé avance, ¿ya le avisó al contratista?', 'No. El borrador no avisa ni cambia el estado. Solo avisa al dar el resultado final.'],
    ['Aprobé pero no aparece en SharePoint, ¿qué hago?', 'Espere unos segundos (sube en segundo plano) y recargue. Si sigue pendiente, use Reintentar subida.'],
  ],
  problemas: [
    ['"Falta la firma del revisor"', 'Ponga su firma antes de dar el resultado final.'],
    ['"No se pudo subir a SharePoint"', 'Lea el motivo, revise internet o permisos, y reintente.'],
    ['"Me devolvió al inicio"', 'Se venció el permiso (dura 24 horas). Entre de nuevo.'],
    ['"No veo un radicado"', 'Quite los filtros y el texto del buscador del Historial.'],
  ],
};

export const MANUAL_SOPORTE = [
  'Correo: coord.tecnico@intecoalsas.com',
  'Teléfonos: 310 355 6449 / (602) 224 8763',
  'Diga siempre su número de radicado y qué mensaje le salió.',
];
