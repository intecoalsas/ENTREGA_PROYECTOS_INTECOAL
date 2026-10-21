import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadicacionForm } from '../RadicacionForm';
import { DOCUMENT_CATALOG } from '../../data/documentsCatalog';

vi.mock('motion/react', async () => {
  const React = await import('react');
  const Div = ({ children, custom, variants, initial, animate, exit, transition, ...rest }) =>
    React.createElement('div', rest, children);
  const Presence = ({ children }) => React.createElement(React.Fragment, null, children);
  return { motion: { div: Div }, AnimatePresence: Presence };
});

const contratista = { email: 'c@t.com', name: 'Contratista Test', role: 'contratista' };
const noop = () => {};

function archivoPrevio(over = {}) {
  return {
    docId: 1, docCode: 'A1', docName: 'Diseño fotométrico aprobado',
    fileName: '', fileSize: 0, fileType: 'application/pdf', uploadDate: '',
    status: 'PENDIENTE', folderPath: '/x/', notes: '', esManual: false,
    ...over,
  };
}

function radicadoEdicion(overArchivos = null) {
  return {
    id: 'test-1',
    numeroRadicado: 'RAD-2026-099',
    estado: 'Con Observaciones',
    observacionesGenerales: 'Faltan planos legibles',
    fechaRadicacion: '2026-09-01T10:00:00+00:00',
    metadata: {
      nombreProyecto: 'Proyecto Test', municipio: 'Tuluá', contratista: 'C Test',
      nitContratista: '123', responsable: 'Resp', correoResponsable: 'c@t.com',
      tipoEntrega: 'Subsanación',
      firmaContratista: { dataUrl: 'data:image/png;base64,AAA', nombreSignatario: 'Resp',
                          cargo: 'Rep', hashVerificacion: 'h1', tarjetaProfesional: 'TP1' },
    },
    archivos: overArchivos || [
      archivoPrevio({ docId: 1, docCode: 'A1', status: 'PENDIENTE', notes: '' }),
      archivoPrevio({ docId: 15, docCode: 'C15', status: 'NO CUMPLE', notes: 'Matrícula ilegible, re-subir', fileName: 'mat.pdf' }),
      archivoPrevio({ docId: 2, docCode: 'A2', status: 'CUMPLE', notes: '', fileName: 'ced.pdf' }),
      archivoPrevio({ docId: 25, docCode: 'CEAP', status: 'PENDIENTE', notes: 'Falta un sub-archivo',
                      subFiles: [{ subId: '25a', subCode: 'CEAP-A', subName: 'Tarjeta', fileName: '', status: 'PENDIENTE' }] }),
    ],
    elementosEntregados: [],
  };
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn());
  window.alert = vi.fn();
  window.confirm = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function tarjetaDoc(code) {
  const marcado = screen.getByText(new RegExp(`#\\d+ ${code}$`));
  return marcado.closest('div[class*="rounded-xl"]');
}

describe('Wizard Radicación — estructura (caja blanca)', () => {
  it('renderiza los 25 requisitos del catálogo y los 3 pasos', () => {
    expect(DOCUMENT_CATALOG).toHaveLength(25);
    render(<RadicacionForm onSuccess={noop} onCancel={noop} currentUser={contratista} />);
    expect(screen.getByText('PASO 1 DE 3')).toBeInTheDocument();
    expect(screen.getByText(/Lista de Verificación Documental/i)).toBeInTheDocument();
    expect(screen.getByText(/#\d+ A1$/)).toBeInTheDocument();
    expect(screen.getByText(/#\d+ CEAP$/)).toBeInTheDocument();
  });

  it('la navegación entre pasos es libre; el freno real está al enviar (confirm)', async () => {
    const user = userEvent.setup();
    render(<RadicacionForm onSuccess={noop} onCancel={noop} currentUser={contratista} />);
    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    expect(screen.getByText('PASO 2 DE 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    expect(screen.getByText('PASO 3 DE 3')).toBeInTheDocument();
  });

  it('creación sin firma: alerta y NO llama al backend', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<RadicacionForm onSuccess={onSuccess} onCancel={noop} currentUser={contratista} />);
    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    await user.click(screen.getByRole('button', { name: /RADICAR DOCUMENTACIÓN/i }));
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('firma digital'));
    expect(fetch).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('firma vía modal + payload multipart exacto (archivo_A1, subFile_25_25a, metadatos con firma)', async () => {
    const user = userEvent.setup();
    window.confirm.mockReturnValue(true);
    fetch.mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'n', numeroRadicado: 'RAD-2026-100' } }) });
    const onSuccess = vi.fn();
    render(<RadicacionForm onSuccess={onSuccess} onCancel={noop} currentUser={contratista} />);

    const cardA1 = tarjetaDoc('A1');
    await user.upload(within(cardA1).getByLabelText(/Adjuntar|Cambiar/), new File(['pdf'], 'a1.pdf', { type: 'application/pdf' }));
    const cardCEAP = tarjetaDoc('CEAP');
    const slotInputs = within(cardCEAP).getAllByLabelText(/Adjuntar|Cambiar/);
    await user.upload(slotInputs[0], new File(['pdf'], 'tarjeta.pdf', { type: 'application/pdf' }));

    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    await user.click(screen.getByRole('button', { name: /Crear \/ Subir Firma/i }));
    await user.type(screen.getByPlaceholderText('Nombre del signatario'), 'Resp Firmante');
    const modalImg = document.querySelector('.fixed.inset-0 input[type="file"]');
    await user.upload(modalImg, new File(['img'], 'firma.png', { type: 'image/png' }));
    await waitFor(() => expect(screen.getByText(/Imagen cargada correctamente/i)).toBeInTheDocument(), { timeout: 3000 });
    await user.click(screen.getByRole('button', { name: /Estampar Firma en Informe/i }));
    await waitFor(() => expect(screen.getByText('Resp Firmante')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /RADICAR DOCUMENTACIÓN/i }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/radicacion/nueva', expect.anything()));
    const body = fetch.mock.calls[0][1].body;
    expect(body.get('archivo_A1').name).toBe('a1.pdf');
    expect(body.get('subFile_25_25a').name).toBe('tarjeta.pdf');
    const meta = JSON.parse(body.get('metadatos'));
    expect(meta.firmaContratista.nombreSignatario).toBe('Resp Firmante');
    expect(meta.firmaContratista.dataUrl).toMatch(/^data:image/);
    expect(meta.firmaContratista.hashVerificacion).toBeTruthy();
    expect(meta.creadorEmail).toBe('c@t.com');
    expect(body.get('docsAdicionales')).toBe('[]');
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  }, 20000);
});

describe('Wizard — modo edición (subsanar)', () => {
  it('muestra observaciones del revisor y bloquea lo verificado (CUMPLE)', () => {
    render(<RadicacionForm onSuccess={noop} onCancel={noop} currentUser={contratista} filingToEdit={radicadoEdicion()} />);
    expect(screen.getByText(/Observaciones de la interventoría/i)).toBeInTheDocument();
    expect(screen.getByText('Faltan planos legibles')).toBeInTheDocument();
    expect(screen.getByText(/Matrícula ilegible, re-subir/i)).toBeInTheDocument();
    expect(screen.getAllByText('VERIFICADO').length).toBeGreaterThanOrEqual(1);
    expect(within(tarjetaDoc('A2')).queryByRole('button', { name: /Adjuntar|Cambiar/ })).toBeNull();
  });

  it('si falta corregir lo observado: confirm con códigos; cancelar frena el envío', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<RadicacionForm onSuccess={onSuccess} onCancel={noop} currentUser={contratista} filingToEdit={radicadoEdicion()} />);
    window.confirm.mockReturnValue(false);
    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    await user.click(screen.getByRole('button', { name: /GUARDAR Y ENVIAR A REVISIÓN/i }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('C15'));
    expect(fetch).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('corrigiendo todo lo observado: sin confirm, PATCHs y onSuccess con mensaje', async () => {
    const user = userEvent.setup();
    window.confirm.mockReturnValue(true);
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { archivos: [] } }) }) 
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) 
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) 
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) 
      .mockResolvedValueOnce({ 
        ok: true,
        json: async () => ({ data: { ...radicadoEdicion(), estado: 'En Revisión' } }),
      });
    const onSuccess = vi.fn();
    render(<RadicacionForm onSuccess={onSuccess} onCancel={noop} currentUser={contratista} filingToEdit={radicadoEdicion()} />);
    const cardC15 = tarjetaDoc('C15');
    await user.upload(within(cardC15).getByLabelText(/Adjuntar|Cambiar/), new File(['x'], 'mat2.pdf', { type: 'application/pdf' }));
    const cardCEAP = tarjetaDoc('CEAP');
    await user.upload(within(cardCEAP).getAllByLabelText(/Adjuntar|Cambiar/)[0], new File(['x'], 'tarjeta2.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    await user.click(screen.getByRole('button', { name: /Siguiente Paso/i }));
    await user.click(screen.getByRole('button', { name: /GUARDAR Y ENVIAR A REVISIÓN/i }));
    expect(window.confirm).not.toHaveBeenCalled();
    await waitFor(() => {
      const metas = fetch.mock.calls.filter(([u]) => u.endsWith('/metadata'));
      expect(metas.length).toBe(1);
      const enviada = JSON.parse(metas[0][1].body);
      expect(enviada.archivos.find(a => a.docId === 15).status).toBe('CUMPLE');
    });
    await waitFor(() => expect(screen.getByText(/enviados correctamente/i)).toBeInTheDocument(), { timeout: 6000 });
    await waitFor(() => expect(onSuccess).toHaveBeenCalled(), { timeout: 8000 });
  }, 25000);
});
