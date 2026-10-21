
export type FilingStatus = 
  | 'Radicado'
  | 'En Revisión'
  | 'Aprobado'
  | 'Con Observaciones';

export type UserRole = 'interventor' | 'contratista' | 'admin';

export interface UserSession {
  isAuthenticated: boolean;
  name: string;
  email: string;
  role: UserRole;
  company: string;
  photoUrl?: string;
  tenantId?: string;
}

export interface SignatureData {
  nombreSignatario: string;
  cargo: string;
  tarjetaProfesional?: string;
  fechaFirma: string;
  dataUrl: string;
  hashVerificacion: string;
}

export interface ProjectMetadata {
  nombreProyecto: string;
  municipio: string;
  contratista: string;
  nitContratista: string;
  responsableRevision?: string;
  responsable: string;
  correoResponsable?: string;
  creadorEmail?: string;
  creadorName?: string;
  tipoEntrega?: string;
  fechaEntrega?: string;
  observaciones?: string;
  firmaInterventoria?: SignatureData;
  firmaContratista?: SignatureData;
}

export interface UploadedFileItem {
  docId: number;
  docCode: string;
  docName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadDate: string;
  status: 'CUMPLE' | 'PENDIENTE' | 'N/A';
  folderPath: string;
  notes?: string;
}

export interface PhysicalElement {
  id: number;
  elemento: string;
  cantidad: number;
  especificacion?: string;
}

export interface FilingRecord {
  id: string;
  numeroRadicado: string;
  metadata: ProjectMetadata;
  estado: FilingStatus;
  documentosOk: number;
  fechaRadicacion: string;
  fechaActualizacion?: string;
  rutaOneDrive: string;
  archivos: UploadedFileItem[];
  elementosEntregados?: PhysicalElement[];
  observacionesGenerales?: string;
  porcentajeCumplimiento: number;
  ipOrigen?: string;
  creadorEmail?: string;
  creadorName?: string;
}

export interface M365Config {
  azureClientId: string;
  azureTenantId: string;
  sharepointSiteId: string;
  sharepointListId: string;
  sharepointLibraryId: string;
  onedriveFolderRoot: string;
  isConnected: boolean;
}

export const FILING_STATUSES: FilingStatus[] = [
  'Radicado',
  'En Revisión',
  'Aprobado',
  'Con Observaciones'
];

export const USER_ROLES = {
  INTERVENTOR: 'interventor',
  CONTRATISTA: 'contratista',
  ADMIN: 'admin'
};
