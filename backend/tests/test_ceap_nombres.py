from backend.grafos import GraphService

CEAP_DOC = {"docId": 25, "docCode": "CEAP", "fileName": "", "status": "CUMPLE"}


def test_sub_archivo_conserva_la_extension_del_archivo_real():
    g = GraphService()
    sub = {"subId": "25a", "subCode": "CEAP-A", "subName": "Tarjeta profesional del diseñador y constructor",
           "fileName": "tarjeta.pdf"}
    ruta = g._ruta_archivo("RAD-1", CEAP_DOC, sub)
    assert ruta.endswith("/CEAP_CEAP-A_Tarjeta_profesional_del_diseñador_y_constructor.pdf")


def test_no_duplica_la_extension_si_el_nombre_del_slot_ya_la_trae():
    g = GraphService()
    sub = {"subId": "25c", "subCode": "CEAP-C", "subName": "Memoria.pdf", "fileName": "memoria.PDF"}
    assert g._ruta_archivo("RAD-1", CEAP_DOC, sub).endswith("/CEAP_CEAP-C_Memoria.pdf")


def test_plan_de_correccion_solo_toca_los_nombres_sin_extension():
    rad = {"numeroRadicado": "RAD-1", "archivos": [dict(CEAP_DOC, subFiles=[
        {"subId": "25a", "subCode": "CEAP-A", "fileName": "tarjeta.pdf"},
        {"subId": "25b", "subCode": "CEAP-B", "fileName": "cedula.pdf"},
    ])]}
    items = [
        {"id": "id-a", "name": "CEAP_CEAP-A_Tarjeta_profesional_del_diseñador_y_constructor"},
        {"id": "id-b", "name": "CEAP_CEAP-B_Cedula.pdf"},
        {"id": "id-x", "name": "CEAP_CEAP-C_Memoria"},
    ]
    cambios = GraphService.planear_correccion_ceap(rad, items)
    assert len(cambios) == 1
    assert cambios[0]["id"] == "id-a"
    assert cambios[0]["nombreNuevo"] == "CEAP_CEAP-A_Tarjeta_profesional_del_diseñador_y_constructor.pdf"


def test_sin_extension_en_el_registro_no_se_renombra():
    rad = {"numeroRadicado": "RAD-1", "archivos": [dict(CEAP_DOC, subFiles=[
        {"subId": "25d", "subCode": "CEAP-D", "fileName": ""},
    ])]}
    items = [{"id": "id-d", "name": "CEAP_CEAP-D_Plano"}]
    assert GraphService.planear_correccion_ceap(rad, items) == []
