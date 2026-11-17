from backend.grafos import CARPETA_POR_DOCUMENTO, GraphService


def test_catalogo_ubica_a2_a4_a7_en_a_y_c18_en_c():
    assert CARPETA_POR_DOCUMENTO[2] == "A_Tecnicos"
    assert CARPETA_POR_DOCUMENTO[3] == "A_Tecnicos"
    assert CARPETA_POR_DOCUMENTO[4] == "A_Tecnicos"
    assert CARPETA_POR_DOCUMENTO[7] == "A_Tecnicos"
    assert CARPETA_POR_DOCUMENTO[18] == "C_Contractuales"
    assert CARPETA_POR_DOCUMENTO[8] == "B_Certificaciones"


def test_destino_de_subida_sigue_al_catalogo_aunque_folderpath_viejo_diga_b():
    g = GraphService()
    assert g._carpeta_destino({"docId": 2, "docCode": "A2", "folderPath": "/B_Certificaciones/"}) == "A_Tecnicos"
    assert g._carpeta_destino({"docId": 18, "docCode": "C18", "folderPath": "/B_Certificaciones/"}) == "C_Contractuales"
    assert g._carpeta_destino({"docId": 14, "docCode": "B14", "folderPath": "/B_Certificaciones/"}) == "B_Certificaciones"


def test_id_del_documento_sale_del_prefijo_del_nombre():
    f = GraphService._id_documento_desde_nombre
    assert f("02_A2_cedula.pdf") == 2
    assert f("18_C18_declaracion.pdf") == 18
    assert f("CEAP_CEAP-A_Tarjeta.pdf") is None
    assert f("100_algo.pdf") is None
    assert f("sin_prefijo.pdf") is None
