from backend.grafos import GraphService

NUM = "RAD-REC-1"
CARP_A = f"Documentos_Radicacion/{NUM}/A_Tecnicos"
CARP_B = f"Documentos_Radicacion/{NUM}/B_Certificaciones"
CARP_CEAP = f"Documentos_Radicacion/{NUM}/E_Otros/Documentos para circuitos exclusivos de AP"


def _rad(archivos):
    return {"numeroRadicado": NUM, "estado": "Aprobado", "archivos": archivos}


def test_recupera_archivo_principal_sin_fileName():
    rad = _rad([{"docId": 1, "docCode": "A1", "fileName": "", "status": "PENDIENTE"}])
    cambios = GraphService.planear_reconstruccion(rad, {CARP_A: ["01_A1_certificado.pdf"]})
    assert len(cambios) == 1
    assert cambios[0]["tipo"] == "archivo" and cambios[0]["fileName"] == "certificado.pdf"


def test_prefijo_de_documento_no_confunde_a1_con_a10():
    rad = _rad([{"docId": 1, "docCode": "A1", "fileName": "", "status": "PENDIENTE"}])
    assert GraphService.planear_reconstruccion(rad, {CARP_A: ["01_A10_otro.pdf"]}) == []


def test_recupera_los_cuatro_subarchivos_ceap():
    rad = _rad([{"docId": 25, "docCode": "CEAP", "fileName": "", "status": "PENDIENTE", "subFiles": []}])
    nombres = {CARP_CEAP: [
        "CEAP_CEAP-A_Tarjeta.pdf", "CEAP_CEAP-B_Cedula.pdf",
        "CEAP_CEAP-C_Memoria.pdf", "CEAP_CEAP-D_Plano.pdf",
    ]}
    cambios = GraphService.planear_reconstruccion(rad, nombres)
    subs = [c for c in cambios if c["tipo"] == "subarchivo"]
    assert sorted(c["subId"] for c in subs) == ["25a", "25b", "25c", "25d"]
    assert next(c for c in subs if c["subId"] == "25a")["fileName"] == "Tarjeta.pdf"


def test_no_sobrescribe_lo_que_ya_esta_en_el_registro():
    rad = _rad([{"docId": 25, "docCode": "CEAP", "fileName": "", "status": "CUMPLE",
                 "subFiles": [{"subId": "25a", "subCode": "CEAP-A", "fileName": "ya.pdf", "localPath": ""}]}])
    cambios = GraphService.planear_reconstruccion(rad, {CARP_CEAP: ["CEAP_CEAP-A_Tarjeta.pdf"]})
    assert [c for c in cambios if c["subId"] == "25a"] == []


def test_recupera_anexos_con_su_numero():
    rad = _rad([{"docId": 14, "docCode": "B14", "fileName": "certificado.pdf", "status": "CUMPLE",
                 "subFiles": []}])
    cambios = GraphService.planear_reconstruccion(rad, {CARP_B: ["B14_ANEXO-1_adicional.pdf"]})
    assert len(cambios) == 1
    assert cambios[0]["tipo"] == "anexo"
    assert cambios[0]["subId"] == "extra_1" and cambios[0]["fileName"] == "adicional.pdf"


def test_aplicar_deja_el_registro_con_archivos_y_subarchivos():
    rad = _rad([
        {"docId": 1, "docCode": "A1", "fileName": "", "status": "PENDIENTE"},
        {"docId": 25, "docCode": "CEAP", "fileName": "", "status": "PENDIENTE", "subFiles": []},
    ])
    cambios = GraphService.planear_reconstruccion(rad, {
        CARP_A: ["01_A1_certificado.pdf"],
        CARP_CEAP: ["CEAP_CEAP-C_Memoria.pdf"],
    })
    GraphService.aplicar_reconstruccion(rad, cambios)
    a1 = rad["archivos"][0]
    ceap = rad["archivos"][1]
    assert a1["fileName"] == "certificado.pdf" and a1["status"] == "CUMPLE"
    sub = next(s for s in ceap["subFiles"] if s["subId"] == "25c")
    assert sub["fileName"] == "Memoria.pdf" and sub["status"] == "CUMPLE"
    assert sub["localPath"] == ""
