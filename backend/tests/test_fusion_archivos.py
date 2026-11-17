from backend.main import _fusionar_archivos


def _ceap(subs):
    return {"docId": 25, "docCode": "CEAP", "fileName": "", "localPath": "", "subFiles": subs}


def test_sub_archivo_subido_en_el_servidor_no_se_pierde_al_guardar_desde_copia_vieja():
    servidor = [_ceap([
        {"subId": "25a", "fileName": "tarjeta.pdf", "localPath": "/disco/25a.pdf", "status": "CUMPLE"},
        {"subId": "25b", "fileName": "cedula.pdf", "localPath": "/disco/25b.pdf", "status": "CUMPLE"},
    ])]
    copia_vieja = [_ceap([])]
    resultado = _fusionar_archivos(servidor, copia_vieja)
    subs = resultado[0]["subFiles"]
    assert {s["subId"] for s in subs} == {"25a", "25b"}
    assert all(s["localPath"] for s in subs)


def test_localpath_de_sub_archivo_se_restaura_desde_el_servidor():
    servidor = [_ceap([{"subId": "25c", "fileName": "memoria.pdf", "localPath": "/disco/25c.pdf"}])]
    entrante = [_ceap([{"subId": "25c", "fileName": "memoria.pdf", "localPath": "", "status": "CUMPLE"}])]
    resultado = _fusionar_archivos(servidor, entrante)
    sub = resultado[0]["subFiles"][0]
    assert sub["localPath"] == "/disco/25c.pdf"
    assert sub["status"] == "CUMPLE"


def test_estado_y_notas_del_cliente_se_respetan():
    servidor = [_ceap([{"subId": "25d", "fileName": "plano.pdf", "localPath": "/disco/25d.pdf", "status": "CUMPLE"}])]
    entrante = [_ceap([{"subId": "25d", "status": "NO CUMPLE", "notes": "falta sello"}])]
    sub = _fusionar_archivos(servidor, entrante)[0]["subFiles"][0]
    assert sub["status"] == "NO CUMPLE"
    assert sub["notes"] == "falta sello"
    assert sub["fileName"] == "plano.pdf"


def test_documento_sin_subarchivos_no_gana_clave_subfiles():
    servidor = [{"docId": 1, "localPath": "/disco/a1.pdf", "subFiles": []}]
    entrante = [{"docId": 1, "status": "CUMPLE"}]
    resultado = _fusionar_archivos(servidor, entrante)
    assert resultado[0]["localPath"] == "/disco/a1.pdf"
    assert "subFiles" not in resultado[0]
