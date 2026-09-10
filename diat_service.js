/**
 * DIATDataService - Capa de servicios para la administración de datos del Portal de Supervisores
 * Diseñado para desacoplar el frontend del almacenamiento físico (Excel / Google Sheets / Base de datos)
 */
/**
 * Utilidad universal para corregir doble codificación UTF-8 / Mojibake
 */
function cleanMojibake(str) {
    if (typeof str !== 'string' || !str) return str || '';
    let result = str;
    try {
        if (/[\u00C2\u00C3]/.test(result)) {
            result = decodeURIComponent(escape(result));
        }
    } catch (e) {}

    return result
        .replace(/Jonathan Mar[ÃA][\xad\s.]*n Gallego/g, 'Jonathan Marín Gallego')
        .replace(/MarÃ­n/g, 'Marín').replace(/MarÃ.n/g, 'Marín')
        .replace(/FÃ­sico/g, 'Físico').replace(/fÃ­sico/g, 'físico')
        .replace(/evidenciÃ³/g, 'evidenció').replace(/verificÃ³/g, 'verificó')
        .replace(/InspecciÃ³n/g, 'Inspección').replace(/inspecciÃ³n/g, 'inspección')
        .replace(/tÃ©cnica/g, 'técnica').replace(/tÃ©cnico/g, 'técnico').replace(/tÃ©cnicas/g, 'técnicas')
        .replace(/TÃ©cnica/g, 'Técnica').replace(/TÃ©cnico/g, 'Técnico').replace(/TÃ©cnicas/g, 'Técnicas')
        .replace(/TÃ@cnic/gi, 'Técnic').replace(/tÃ@cnic/gi, 'técnic')
        .replace(/ejecuciÃ³n/g, 'ejecución').replace(/priorizaciÃ³n/g, 'priorización')
        .replace(/dosificaciÃ³n/g, 'dosificación').replace(/articulaciÃ³n/g, 'articulación')
        .replace(/AcciÃ³n/g, 'Acción').replace(/acciÃ³n/g, 'acción')
        .replace(/dÃ­a/g, 'día').replace(/realizÃ³/g, 'realizó')
        .replace(/verificaciÃ³n/g, 'verificación').replace(/vÃ­as/g, 'vías')
        .replace(/intervenciÃ³n/g, 'intervención').replace(/jurisdicciÃ³n/g, 'jurisdicción')
        .replace(/acompaÃ±amiento/g, 'acompañamiento').replace(/cumpliÃ³/g, 'cumplió')
        .replace(/Ã¡/g, 'á').replace(/Ã/g, 'Á')
        .replace(/Ã©/g, 'é').replace(/Ã/g, 'É')
        .replace(/Ã­/g, 'í').replace(/Ã/g, 'Í')
        .replace(/Ã³/g, 'ó').replace(/Ã/g, 'Ó')
        .replace(/Ãº/g, 'ú').replace(/Ã/g, 'Ú')
        .replace(/Ã±/g, 'ñ').replace(/Ã/g, 'Ñ')
        .replace(/Ã¼/g, 'ü').replace(/Ã/g, 'Ü')
        .replace(/Â°/g, '°').replace(/Â¿/g, '¿')
        .replace(/Â¡/g, '¡');
}

function sanitizeVisit(v) {
    if (!v) return v;
    let pList = [];
    if (Array.isArray(v.photos) && v.photos.length > 0) {
        pList = v.photos;
    } else if (Array.isArray(v.fotos) && v.fotos.length > 0) {
        pList = v.fotos;
    } else if (typeof v.fotos === 'string' && v.fotos.trim().startsWith('[')) {
        try { pList = JSON.parse(v.fotos); } catch(e) { pList = []; }
    } else if (typeof v.photos === 'string' && v.photos.trim().startsWith('[')) {
        try { pList = JSON.parse(v.photos); } catch(e) { pList = []; }
    }

    return {
        ...v,
        photos: pList,
        photoCount: pList.length,
        usuario: cleanMojibake(v.usuario || ''),
        tipo: cleanMojibake(v.tipo || ''),
        municipio: cleanMojibake(v.municipio || ''),
        subregion: cleanMojibake(v.subregion || ''),
        observaciones: cleanMojibake(v.observaciones || ''),
        compromisos: cleanMojibake(v.compromisos || ''),
        riesgos: cleanMojibake(v.riesgos || '')
    };
}

window.cleanMojibake = cleanMojibake;
window.sanitizeVisit = sanitizeVisit;

class DIATDataService {
    static SUPABASE_URL = 'https://wjkqnwgoppgzphjtymdo.supabase.co';
    static SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indqa3Fud2dvcHBnenBoanR5bWRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTEwMDQsImV4cCI6MjEwNDYyNzAwNH0.W8C-ii4kBW2-OBkqWSFzhAee0NY1thKxv8ieBHVmfSE';
    static STORAGE_BUCKET = 'visitas-fotos';

    static getSupabase() {
        if (window.supabaseClient) return window.supabaseClient;
        if (typeof supabase !== 'undefined' && supabase.createClient) {
            window.supabaseClient = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            return window.supabaseClient;
        }
        return null;
    }

    /**
     * Calcula el hash criptográfico SHA-256 en hexadecimal (Web Crypto API)
     * @param {string} plainText 
     * @returns {Promise<string>}
     */
    static async hashPassword(plainText) {
        const str = String(plainText || '');
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(str);
                const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (e) {
                console.warn('[DIAT Crypto] Fallback Web Crypto:', e);
            }
        }
        // Fallback para entornos sin WebCrypto
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return String(Math.abs(hash));
    }

    /**
     * Registra un evento en la tabla auditoria_actividad de Supabase con respaldo local
     * @param {string} tipoEvento 
     * @param {Object} options 
     */
    static async logActivity(tipoEvento, options = {}) {
        try {
            let userKey = options.usuario;
            let userName = options.nombre;
            if (!userKey && typeof getLoggedUser === 'function') {
                const u = getLoggedUser();
                if (u) {
                    userKey = u.username;
                    userName = u.name;
                }
            }
            if (!userKey && typeof window._pendingChangeUser === 'string') {
                userKey = window._pendingChangeUser;
            }
            if (!userKey) userKey = 'ANONIMO';
            if (!userName) userName = userKey;

            const payload = {
                usuario_corto: String(userKey).toUpperCase(),
                nombre_usuario: String(userName),
                tipo_evento: String(tipoEvento),
                convenio_id: options.convenioId ? String(options.convenioId) : null,
                descripcion: options.descripcion || '',
                detalles: options.detalles || {},
                user_agent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.slice(0, 150) : ''
            };

            // 1. Guardar copia en historial local
            try {
                const localLogs = JSON.parse(localStorage.getItem('diat_audit_logs') || '[]');
                localLogs.unshift({ ...payload, fecha_hora: new Date().toISOString() });
                if (localLogs.length > 300) localLogs.length = 300;
                localStorage.setItem('diat_audit_logs', JSON.stringify(localLogs));
            } catch(e) {}

            // 2. Persistir en Supabase PostgreSQL
            const client = this.getSupabase();
            if (client) {
                const { error } = await client.from('auditoria_actividad').insert([payload]);
                if (error) {
                    console.warn('[DIAT Auditoría] Aviso guardando log en Supabase (requiere ejecutar script SQL si la tabla no existe):', error.message);
                } else {
                    console.log(`[DIAT Auditoría] Evento ${tipoEvento} registrado en Supabase.`);
                }
            }
        } catch (err) {
            console.warn('[DIAT Auditoría] Excepción registrando actividad:', err);
        }
    }

    /**
     * Consulta los registros de auditoría más recientes desde Supabase PostgreSQL
     * @param {number} limit 
     * @returns {Promise<Array>}
     */
    static async getAuditLogs(limit = 100) {
        const client = this.getSupabase();
        if (client) {
            try {
                const { data, error } = await client
                    .from('auditoria_actividad')
                    .select('*')
                    .order('fecha_hora', { ascending: false })
                    .limit(limit);
                if (!error && Array.isArray(data) && data.length > 0) {
                    return data;
                }
            } catch (e) {
                console.warn('[DIAT Auditoría] Error consultando logs en Supabase, usando respaldo local:', e);
            }
        }
        try {
            return JSON.parse(localStorage.getItem('diat_audit_logs') || '[]');
        } catch (e) {
            return [];
        }
    }

    static cleanText(str) {
        return cleanMojibake(str);
    }

    static getChanges() {
        try {
            return JSON.parse(localStorage.getItem('diat_convenio_changes')) || {};
        } catch (e) {
            return {};
        }
    }

    static saveChanges(changes) {
        localStorage.setItem('diat_convenio_changes', JSON.stringify(changes));
    }

    static getDeletedVisitIds() {
        try {
            const raw = localStorage.getItem('diat_deleted_visit_ids');
            if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) return new Set(list);
            }
        } catch (e) {}
        return new Set();
    }

    static addDeletedVisitId(id) {
        if (!id) return;
        const set = this.getDeletedVisitIds();
        set.add(String(id).trim());
        localStorage.setItem('diat_deleted_visit_ids', JSON.stringify(Array.from(set)));
    }

    static getTechnicalVisits() {
        try {
            const raw = localStorage.getItem('diat_technical_visits');
            if (raw) {
                const stored = JSON.parse(raw);
                if (Array.isArray(stored)) {
                    // Purga de seguridad si detecta visitas simuladas previas con fotos de Unsplash
                    const hasMock = stored.some(v => v.id && (v.id.includes('VT-25AS111B2809-') || v.id.includes('VT-25AS111B2780-') || (v.photos && v.photos.some(p => typeof p === 'string' && p.includes('unsplash')))));
                    if (hasMock) {
                        localStorage.removeItem('diat_technical_visits');
                    } else {
                        const deletedIds = this.getDeletedVisitIds();
                        return stored.filter(v => v && v.id && v.id.startsWith('VT-') && !v.id.startsWith('TEST-') && !v._delete && !v.delete && v.estado !== 'Eliminada' && v.estado !== 'Eliminado' && !deletedIds.has(v.id)).map(v => sanitizeVisit({
                            ...v,
                            estado: v.estado || 'Realizada',
                            prioridad: v.prioridad || 'Media'
                        }));
                    }
                }
            }
        } catch (e) {
            console.error('Error leyendo diat_technical_visits:', e);
        }
        return [];
    }

    static saveTechnicalVisits(visits) {
        const deletedIds = this.getDeletedVisitIds();
        const cleanList = (visits || [])
            .filter(v => v && v.id && !deletedIds.has(v.id) && !v._delete && !v.delete && v.estado !== 'Eliminada' && v.estado !== 'Eliminado')
            .map(v => sanitizeVisit(v));
        localStorage.setItem('diat_technical_visits', JSON.stringify(cleanList));
    }

    static getChangeHistory() {
        try {
            return JSON.parse(localStorage.getItem('diat_change_history')) || [];
        } catch (e) {
            return [];
        }
    }

    static saveChangeHistory(history) {
        localStorage.setItem('diat_change_history', JSON.stringify(history));
    }

    /**
     * Une los datos maestros provenientes del Excel con los cambios locales almacenados en localStorage
     * @param {Array} baseRows Datos leídos directamente desde el Excel
     */
    static mergeData(baseRows) {
        const changes = this.getChanges();
        let changesUpdated = false;

        // Limpiar overrides locales que coinciden con los datos maestros (self-healing)
        baseRows.forEach(row => {
            const id = String(row['CONVENIO']).trim();
            if (changes[id]) {
                Object.keys(changes[id]).forEach(field => {
                    const baseVal = row[field];
                    const overrideVal = changes[id][field];

                    if (baseVal !== undefined) {
                        let match = false;
                        if (typeof overrideVal === 'number' || typeof baseVal === 'number') {
                            const numBase = parseFloat(baseVal) || 0;
                            const numOverride = parseFloat(overrideVal) || 0;
                            match = (Math.abs(numBase - numOverride) < 0.01);
                        } else {
                            match = (String(baseVal).trim().toLowerCase() === String(overrideVal).trim().toLowerCase());
                        }

                        if (match) {
                            delete changes[id][field];
                            changesUpdated = true;
                        }
                    }
                });

                if (Object.keys(changes[id]).length === 0) {
                    delete changes[id];
                    changesUpdated = true;
                }
            }
        });

        if (changesUpdated) {
            this.saveChanges(changes);
        }

        return baseRows.map(row => {
            const id = String(row['CONVENIO']).trim();
            if (changes[id]) {
                const mergedRow = { ...row };

                // Mezclar todos los campos locales actualizados
                Object.keys(changes[id]).forEach(field => {
                    mergedRow[field] = changes[id][field];
                });

                // Mapear campos con nombres alternativos utilizados en el frontend
                if (changes[id]['LONGITUD EJECUTADA CUATRENIO(m)'] !== undefined) {
                    mergedRow['LONGITUD EJECUTADA CUATRENIO'] = parseFloat(changes[id]['LONGITUD EJECUTADA CUATRENIO(m)']) || 0;
                }
                if (changes[id]['AREA EJECUTADA CUATRENIO (m2)'] !== undefined) {
                    mergedRow['AREA EJECUTADA CUATRENIO (M2)'] = parseFloat(changes[id]['AREA EJECUTADA CUATRENIO (m2)']) || 0;
                }
                if (changes[id]['LONGITUD EJECUTADA (m)'] !== undefined) {
                    mergedRow['LONGITUD EJECUTADA'] = parseFloat(changes[id]['LONGITUD EJECUTADA (m)']) || 0;
                }
                if (changes[id]['AREA EJECUTADA (m2)'] !== undefined) {
                    mergedRow['AREA EJECUTADA (M2)'] = parseFloat(changes[id]['AREA EJECUTADA (m2)']) || 0;
                }

                // Recalcular avances físicos y financieros para que el frontend los muestre actualizados
                const v = parseInt(mergedRow['VIGENCIA'], 10);
                const isAnterior = !isNaN(v) && v < 2024;
                const alcanceM = isAnterior ? 0 : (parseFloat(mergedRow['ALCANCE (m)'] || mergedRow['ALCANCE (M)']) || 0);
                const alcanceM2 = isAnterior ? 0 : (parseFloat(mergedRow['ALCANCE (m2)'] || mergedRow['ALCANCE (M2)']) || 0);
                const longitud = isAnterior ? (parseFloat(mergedRow['LONGITUD EJECUTADA CUATRENIO']) || 0) : (parseFloat(mergedRow['LONGITUD EJECUTADA']) || 0);
                const area = isAnterior ? (parseFloat(mergedRow['AREA EJECUTADA CUATRENIO (M2)']) || 0) : (parseFloat(mergedRow['AREA EJECUTADA (M2)']) || 0);

                let pfis = 0;
                if (alcanceM > 0) {
                    pfis = (longitud / alcanceM) * 100;
                } else if (alcanceM2 > 0) {
                    pfis = (area / alcanceM2) * 100;
                }
                mergedRow['FISICO_NORM'] = pfis;
                mergedRow['% EJECUCIÓN FÍSICA'] = pfis / 100;

                const desembolsado = parseFloat(mergedRow['VALOR TOTAL DESEMBOLSADO']) || 0;
                const adeudado = parseFloat(mergedRow['VALOR TOTAL AUTORIZADO DEPARTAMENTO']) || 0;

                let pfin = 0;
                if (desembolsado > 0) {
                    pfin = (adeudado / desembolsado) * 100;
                }
                mergedRow['FINANCIERO_NORM'] = pfin;
                mergedRow['% EJECUCIÓN FINANCIERA (RECURSOS DEPARTAMENTO)'] = pfin / 100;

                return mergedRow;
            }
            return row;
        });
    }

    /**
     * Guarda la actualización de un convenio y registra los logs correspondientes en el historial
     */
    static async saveConvenioUpdate(username, convenioId, updatedFields, originalRow) {
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBFslIOCwVCyAae8-FG0VL5pqotLkjejwJhavm5xoGU4SlyVETwRkGCmDNVkcRPw4/exec";
        let isSuccess = false;

        try {
            // Intento 1: Petición estándar CORS para obtener respuesta de éxito/error estructurada
            const response = await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "cors",
                headers: {
                    "Content-Type": "text/plain"
                },
                body: JSON.stringify({
                    convenioId: convenioId,
                    updatedFields: updatedFields
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    isSuccess = true;
                } else {
                    throw new Error(result.error || "Error reportado por Apps Script");
                }
            } else {
                throw new Error(`Servidor retornó código ${response.status}`);
            }
        } catch (corsError) {
            if (corsError instanceof TypeError) {
                console.warn("Fallo en intento principal (posible bloqueo CORS o falta de nueva publicación de Apps Script). Reintentando en modo de compatibilidad sin CORS...", corsError);

                try {
                    // Intento 2: Modo no-cors (Modo compatible de una vía).
                    // Envía la petición HTTP de forma segura a Google pero no lee la respuesta, evitando bloqueos de CORS del navegador.
                    await fetch(GOOGLE_SCRIPT_URL, {
                        method: "POST",
                        mode: "no-cors",
                        headers: {
                            "Content-Type": "text/plain"
                        },
                        body: JSON.stringify({
                            convenioId: convenioId,
                            updatedFields: updatedFields
                        })
                    });

                    // En modo no-cors no podemos validar la respuesta, por lo que asumimos que se envió correctamente
                    isSuccess = true;
                } catch (fallbackError) {
                    console.error("Fallo definitivo de red al sincronizar con Google Sheets:", fallbackError);
                    alert("Error crítico de red al sincronizar con Google Sheets. Verifica tu conexión.");
                    return false;
                }
            } else {
                console.error("Error devuelto por la ejecución del script:", corsError);
                alert("Error al actualizar convenio: " + corsError.message);
                return false;
            }
        }

        if (isSuccess) {
            // Registrar localmente para auditoría e historial del supervisor
            const changes = this.getChanges();
            if (!changes[convenioId]) {
                changes[convenioId] = {};
            }

            const history = this.getChangeHistory();
            const now = new Date();
            const fecha = now.toLocaleDateString('es-CO');
            const hora = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            Object.keys(updatedFields).forEach(field => {
                const oldVal = originalRow[field] !== undefined ? originalRow[field] : '';
                const newVal = updatedFields[field];

                if (String(oldVal) !== String(newVal)) {
                    changes[convenioId][field] = newVal;
                    history.unshift({
                        usuario: username,
                        fecha: fecha,
                        hora: hora,
                        convenio: convenioId,
                        campo: field,
                        valorAnterior: String(oldVal),
                        valorNew: String(newVal)
                    });
                }
            });

            this.saveChanges(changes);
            this.saveChangeHistory(history);

            // Registrar auditoría en Supabase PostgreSQL
            this.logActivity('ACTUALIZACION_CONVENIO', {
                usuario: username,
                convenioId: convenioId,
                descripcion: `Actualización de campos en convenio ${convenioId} por ${username}.`,
                detalles: {
                    convenio: convenioId,
                    camposModificados: Object.keys(updatedFields),
                    valoresNuevos: updatedFields
                }
            });

            return true;
        }

        return false;
    }

    /**
     * Ubicación oficial del archivo visitas.json en Google Drive
     */
    static DRIVE_VISITAS_FOLDER_ID = "1CxF2U_2FlvWMClR-esobPlEoyeWgZsBu";
    static DRIVE_VISITAS_FOLDER_URL = "https://drive.google.com/drive/folders/1CxF2U_2FlvWMClR-esobPlEoyeWgZsBu?usp=sharing";
    static DRIVE_VISITAS_FILENAME = "visitas.json";

    /**
     * Retorna los metadatos de ubicación de visitas.json en Google Drive
     */
    static getVisitasDriveLocation() {
        return {
            folderId: this.DRIVE_VISITAS_FOLDER_ID,
            folderUrl: this.DRIVE_VISITAS_FOLDER_URL,
            filename: this.DRIVE_VISITAS_FILENAME
        };
    }

    /**
     * Sube una fotografía (DataURL base64 o File/Blob) al bucket de Supabase Storage
     * y retorna la URL pública de CDN optimizada
     */
    static async uploadPhotoToStorage(fileOrDataUrl, filenamePrefix = 'photo') {
        const client = this.getSupabase();
        if (!client) return fileOrDataUrl;

        try {
            if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('http')) {
                // Ya es una URL pública en la nube
                return fileOrDataUrl;
            }

            let blob = null;
            let ext = 'jpg';
            let contentType = 'image/jpeg';

            if (typeof fileOrDataUrl === 'string' && fileOrDataUrl.startsWith('data:image/')) {
                const match = fileOrDataUrl.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
                if (match) {
                    ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                    contentType = `image/${match[1]}`;
                    const byteChars = atob(match[2]);
                    const byteNums = new Array(byteChars.length);
                    for (let i = 0; i < byteChars.length; i++) {
                        byteNums[i] = byteChars.charCodeAt(i);
                    }
                    blob = new Blob([new Uint8Array(byteNums)], { type: contentType });
                } else {
                    return fileOrDataUrl;
                }
            } else if (fileOrDataUrl instanceof Blob || (typeof File !== 'undefined' && fileOrDataUrl instanceof File)) {
                blob = fileOrDataUrl;
                contentType = blob.type || 'image/jpeg';
                ext = contentType.includes('png') ? 'png' : 'jpg';
            } else {
                return fileOrDataUrl;
            }

            const cleanPrefix = String(filenamePrefix).replace(/[^a-zA-Z0-9_-]/g, '_');
            const uniqueFilename = `${cleanPrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

            const { data, error } = await client.storage
                .from(this.STORAGE_BUCKET)
                .upload(uniqueFilename, blob, {
                    contentType: contentType,
                    upsert: true
                });

            if (error) {
                console.error('[DIAT Supabase Storage] Error subiendo foto:', error);
                return fileOrDataUrl;
            }

            const { data: publicData } = client.storage
                .from(this.STORAGE_BUCKET)
                .getPublicUrl(uniqueFilename);

            return publicData ? publicData.publicUrl : fileOrDataUrl;
        } catch (e) {
            console.error('[DIAT Supabase Storage] Excepción procesando foto:', e);
            return fileOrDataUrl;
        }
    }

    /**
     * Sincroniza las visitas técnicas registradas desde Supabase PostgreSQL (con fallback a Google Drive)
     */
    static async syncTechnicalVisitsFromServer() {
        const deletedIds = this.getDeletedVisitIds();
        let loadedVisits = null;

        // 1. Intento principal: Consultar base de datos Supabase PostgreSQL
        const client = this.getSupabase();
        if (client) {
            try {
                const { data: supaVisits, error } = await client
                    .from('visitas_tecnicas')
                    .select('*')
                    .order('fecha', { ascending: false });

                if (!error && Array.isArray(supaVisits) && supaVisits.length > 0) {
                    loadedVisits = supaVisits
                        .filter(v => v && v.id && !deletedIds.has(v.id) && v.estado !== 'Eliminada' && v.estado !== 'Eliminado')
                        .map(v => sanitizeVisit({
                            id: v.id,
                            convenioId: v.convenio_id || v.convenio_numero,
                            usuario: cleanMojibake(v.supervisor_nombre || 'Jonathan Marín Gallego'),
                            supervisorEmail: v.supervisor_email || '',
                            fecha: v.fecha,
                            hora: v.hora || '',
                            tipo: cleanMojibake(v.tipo_visita || 'Seguimiento Técnico'),
                            estado: v.estado || 'Realizada',
                            prioridad: 'Media',
                            municipio: cleanMojibake(v.municipio || ''),
                            porcentajeAvanceFisico: parseFloat(v.porcentaje_avance_fisico) || 0,
                            porcentajeAvanceFinanciero: parseFloat(v.porcentaje_avance_financiero) || 0,
                            observaciones: cleanMojibake(v.observaciones || ''),
                            compromisos: cleanMojibake(v.compromisos || ''),
                            recomendaciones: cleanMojibake(v.recomendaciones || ''),
                            lat: parseFloat(v.ubicacion_lat) || 0,
                            lng: parseFloat(v.ubicacion_lng) || 0,
                            photoCount: Array.isArray(v.fotos) ? v.fotos.length : 0,
                            photos: Array.isArray(v.fotos) ? v.fotos : []
                        }));
                }
            } catch (supaErr) {
                console.warn('[DIAT] Supabase no disponible en este momento:', supaErr);
            }
        }

        // Si obtuvimos visitas desde Supabase, consolidar con caché local
        if (loadedVisits && loadedVisits.length > 0) {
            const localVisits = this.getTechnicalVisits().filter(v => !deletedIds.has(v.id));
            const visitMap = new Map();
            loadedVisits.forEach(v => visitMap.set(v.id, v));
            localVisits.forEach(v => {
                if (!visitMap.has(v.id)) visitMap.set(v.id, sanitizeVisit(v));
            });
            const unified = Array.from(visitMap.values()).filter(v => !deletedIds.has(v.id));
            this.saveTechnicalVisits(unified);
            window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits: unified } }));
            return true;
        }

        // 2. Fallback a Google Drive (visitas.json)
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBFslIOCwVCyAae8-FG0VL5pqotLkjejwJhavm5xoGU4SlyVETwRkGCmDNVkcRPw4/exec";
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getVisits&folderId=${this.DRIVE_VISITAS_FOLDER_ID}&folderUrl=${encodeURIComponent(this.DRIVE_VISITAS_FOLDER_URL)}&file=${encodeURIComponent(this.DRIVE_VISITAS_FILENAME)}`);
            if (response.ok) {
                const visits = await response.json();
                if (Array.isArray(visits) && visits.length > 0) {
                    visits.forEach(v => {
                        if (v && v.id && (v._delete === true || v.delete === true || v.estado === 'Eliminada' || v.estado === 'Eliminado' || v.eliminado === true)) {
                            this.addDeletedVisitId(v.id);
                        }
                    });

                    const currentDeleted = this.getDeletedVisitIds();
                    const validServerVisits = visits.filter(v => {
                        if (!v || !v.id || !v.id.startsWith('VT-') || v.id.startsWith('TEST-')) return false;
                        if (v._delete === true || v.delete === true || v.estado === 'Eliminada' || v.estado === 'Eliminado' || v.eliminado === true) return false;
                        if (currentDeleted.has(v.id)) return false;
                        return true;
                    }).map(v => sanitizeVisit({
                        ...v,
                        estado: v.estado || 'Realizada',
                        prioridad: v.prioridad || 'Media'
                    }));

                    const localVisits = this.getTechnicalVisits().filter(v => !currentDeleted.has(v.id));
                    const visitMap = new Map();
                    validServerVisits.forEach(v => visitMap.set(v.id, v));
                    localVisits.forEach(v => {
                        if (!visitMap.has(v.id)) {
                            visitMap.set(v.id, sanitizeVisit(v));
                        }
                    });

                    const merged = Array.from(visitMap.values()).filter(v => !currentDeleted.has(v.id));
                    this.saveTechnicalVisits(merged);

                    window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits: merged } }));
                    return true;
                }
            }
        } catch (e) {
            console.error("Error sincronizando visitas desde Google Drive (visitas.json):", e);
        }

        // 3. Fallback: archivo local estático visitas.json
        try {
            const localResp = await fetch('./visitas.json');
            if (localResp.ok) {
                const localVisits = await localResp.json();
                if (Array.isArray(localVisits) && localVisits.length > 0) {
                    const currentDeleted = this.getDeletedVisitIds();
                    const current = this.getTechnicalVisits().filter(v => !currentDeleted.has(v.id));
                    const visitMap = new Map();
                    current.forEach(v => visitMap.set(v.id, sanitizeVisit(v)));
                    localVisits.filter(v => v && v.id && v.id.startsWith('VT-') && !v.id.startsWith('TEST-') && !currentDeleted.has(v.id) && !v._delete && !v.delete && v.estado !== 'Eliminada' && v.estado !== 'Eliminado').forEach(v => {
                        if (!visitMap.has(v.id)) {
                            visitMap.set(v.id, sanitizeVisit({
                                ...v,
                                estado: v.estado || 'Realizada',
                                prioridad: v.prioridad || 'Media'
                            }));
                        }
                    });
                    const mergedLocal = Array.from(visitMap.values()).filter(v => !currentDeleted.has(v.id));
                    this.saveTechnicalVisits(mergedLocal);
                    window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits: mergedLocal } }));
                    return true;
                }
            }
        } catch (localErr) {
            console.warn("Fallback local de visitas.json no disponible:", localErr);
        }

        return false;
    }

    /**
     * Registra una visita técnica en Supabase PostgreSQL y sube sus fotos al bucket Storage
     */
    static async addTechnicalVisit(username, convenioId, visitData) {
        const vId = 'VT-' + Date.now();
        let finalPhotos = [];

        // 1. Subir fotos a Supabase Storage en paralelo si existen
        if (Array.isArray(visitData.photos) && visitData.photos.length > 0) {
            try {
                const uploadPromises = visitData.photos.map((ph, idx) => 
                    this.uploadPhotoToStorage(ph, `${vId}_p${idx + 1}`)
                );
                finalPhotos = await Promise.all(uploadPromises);
            } catch (uploadErr) {
                console.warn('[DIAT] Error procesando fotos para storage:', uploadErr);
                finalPhotos = visitData.photos;
            }
        }

        const newVisit = sanitizeVisit({
            id: vId,
            convenioId: String(convenioId).trim(),
            usuario: username || 'Jonathan Marín Gallego',
            estado: visitData.estado || 'Realizada',
            prioridad: visitData.prioridad || 'Media',
            fecha: visitData.fecha || new Date().toISOString().split('T')[0],
            tipo: visitData.tipo || 'Avance de obra',
            municipio: visitData.municipio || '',
            subregion: visitData.subregion || '',
            observaciones: visitData.observaciones || '',
            compromisos: visitData.compromisos || '',
            riesgos: visitData.riesgos || '',
            lat: parseFloat(visitData.lat) || 0,
            lng: parseFloat(visitData.lng) || 0,
            photoCount: finalPhotos.length,
            photos: finalPhotos
        });

        // 2. Guardar en caché local y notificar UI inmediatamente
        const visits = this.getTechnicalVisits();
        visits.unshift(newVisit);
        this.saveTechnicalVisits(visits);
        window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits } }));

        // 3. Guardar en Supabase PostgreSQL
        const client = this.getSupabase();
        if (client) {
            try {
                let fStr = newVisit.fecha;
                if (fStr && fStr.includes('/')) {
                    const p = fStr.split('/');
                    fStr = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                }

                await client.from('visitas_tecnicas').upsert({
                    id: newVisit.id,
                    convenio_id: newVisit.convenioId,
                    convenio_numero: newVisit.convenioId,
                    municipio: newVisit.municipio,
                    supervisor_nombre: newVisit.usuario,
                    fecha: fStr || new Date().toISOString().split('T')[0],
                    tipo_visita: newVisit.tipo,
                    estado: newVisit.estado,
                    porcentaje_avance_fisico: parseFloat(visitData.porcentajeAvanceFisico) || 0,
                    porcentaje_avance_financiero: parseFloat(visitData.porcentajeAvanceFinanciero) || 0,
                    observaciones: newVisit.observaciones,
                    compromisos: newVisit.compromisos,
                    recomendaciones: newVisit.riesgos || '',
                    ubicacion_lat: newVisit.lat || null,
                    ubicacion_lng: newVisit.lng || null,
                    fotos: finalPhotos,
                    updated_at: new Date().toISOString()
                });
                console.log(`[DIAT Supabase] Visita ${newVisit.id} persistida en PostgreSQL`);
            } catch (err) {
                console.error('[DIAT Supabase] Error guardando visita en PostgreSQL:', err);
            }
        }

        // 4. Sincronizar respaldo secundario con Google Drive en segundo plano
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBFslIOCwVCyAae8-FG0VL5pqotLkjejwJhavm5xoGU4SlyVETwRkGCmDNVkcRPw4/exec";
        try {
            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: "saveVisit",
                    folderId: this.DRIVE_VISITAS_FOLDER_ID,
                    folderUrl: this.DRIVE_VISITAS_FOLDER_URL,
                    file: this.DRIVE_VISITAS_FILENAME,
                    visit: newVisit
                })
            }).catch(e => console.error("Error asíncrono enviando visita a Drive:", e));
        } catch (e) {
            console.error("Error enviando visita a Google Drive:", e);
        }

        // 5. Registrar auditoría en Supabase
        this.logActivity('REGISTRO_VISITA', {
            usuario: username,
            convenioId: newVisit.convenio_numero,
            descripcion: `Registro de visita técnica ${newVisit.id} en ${newVisit.municipio || 'obra'}.`,
            detalles: {
                visitaId: newVisit.id,
                tipo: newVisit.tipo,
                municipio: newVisit.municipio,
                subregion: newVisit.subregion,
                fotosCount: (newVisit.photos || []).length
            }
        });

        return newVisit;
    }

    /**
     * Actualiza una visita técnica en Supabase PostgreSQL y sube fotos nuevas si aplica
     */
    static async updateTechnicalVisit(visitId, visitData) {
        const visits = this.getTechnicalVisits();
        const idx = visits.findIndex(v => v.id === visitId);
        if (idx === -1) return null;

        let finalPhotos = visits[idx].photos || [];
        if (Array.isArray(visitData.photos)) {
            try {
                const uploadPromises = visitData.photos.map((ph, pIdx) => 
                    this.uploadPhotoToStorage(ph, `${visitId}_p${pIdx + 1}`)
                );
                finalPhotos = await Promise.all(uploadPromises);
            } catch (e) {
                finalPhotos = visitData.photos;
            }
        }

        const updatedVisit = sanitizeVisit({
            ...visits[idx],
            estado: visitData.estado !== undefined ? visitData.estado : visits[idx].estado || 'Realizada',
            prioridad: visitData.prioridad !== undefined ? visitData.prioridad : visits[idx].prioridad || 'Media',
            fecha: visitData.fecha !== undefined ? visitData.fecha : visits[idx].fecha,
            tipo: visitData.tipo !== undefined ? visitData.tipo : visits[idx].tipo,
            municipio: visitData.municipio !== undefined ? visitData.municipio : visits[idx].municipio,
            subregion: visitData.subregion !== undefined ? visitData.subregion : visits[idx].subregion,
            observaciones: visitData.observaciones !== undefined ? visitData.observaciones : visits[idx].observaciones,
            compromisos: visitData.compromisos !== undefined ? visitData.compromisos : visits[idx].compromisos,
            riesgos: visitData.riesgos !== undefined ? visitData.riesgos : visits[idx].riesgos,
            lat: visitData.lat !== undefined ? parseFloat(visitData.lat) || 0 : visits[idx].lat,
            lng: visitData.lng !== undefined ? parseFloat(visitData.lng) || 0 : visits[idx].lng,
            photoCount: finalPhotos.length,
            photos: finalPhotos
        });

        // 1. Guardar en caché local y notificar UI
        visits[idx] = updatedVisit;
        this.saveTechnicalVisits(visits);
        window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits } }));

        // 2. Actualizar en Supabase PostgreSQL
        const client = this.getSupabase();
        if (client) {
            try {
                let fStr = updatedVisit.fecha;
                if (fStr && fStr.includes('/')) {
                    const p = fStr.split('/');
                    fStr = `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
                }

                await client.from('visitas_tecnicas').update({
                    tipo_visita: updatedVisit.tipo,
                    estado: updatedVisit.estado,
                    municipio: updatedVisit.municipio,
                    fecha: fStr,
                    observaciones: updatedVisit.observaciones,
                    compromisos: updatedVisit.compromisos,
                    recomendaciones: updatedVisit.riesgos,
                    ubicacion_lat: updatedVisit.lat || null,
                    ubicacion_lng: updatedVisit.lng || null,
                    fotos: finalPhotos,
                    updated_at: new Date().toISOString()
                }).eq('id', visitId);
            } catch (err) {
                console.error('[DIAT Supabase] Error actualizando visita en PostgreSQL:', err);
            }
        }

        // 3. Respaldo secundario Google Drive
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBFslIOCwVCyAae8-FG0VL5pqotLkjejwJhavm5xoGU4SlyVETwRkGCmDNVkcRPw4/exec";
        try {
            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({
                    action: "saveVisit",
                    folderId: this.DRIVE_VISITAS_FOLDER_ID,
                    folderUrl: this.DRIVE_VISITAS_FOLDER_URL,
                    file: this.DRIVE_VISITAS_FILENAME,
                    visit: updatedVisit
                })
            }).catch(e => console.error("Error asíncrono actualizando visita en Drive:", e));
        } catch (e) {
            console.error("Error actualizando visita en Google Drive:", e);
        }

        // 4. Registrar auditoría en Supabase
        this.logActivity('ACTUALIZACION_VISITA', {
            usuario: updatedVisit.usuario,
            convenioId: updatedVisit.convenio_numero,
            descripcion: `Actualización de visita técnica ${visitId} (${updatedVisit.estado}).`,
            detalles: {
                visitaId: visitId,
                estado: updatedVisit.estado,
                tipo: updatedVisit.tipo
            }
        });

        return updatedVisit;
    }

    /**
     * Marca una visita programada como realizada
     */
    static async markVisitAsCompleted(visitId, completionData = {}) {
        return this.updateTechnicalVisit(visitId, {
            estado: 'Realizada',
            fecha: completionData.fecha || new Date().toLocaleDateString('es-CO'),
            observaciones: completionData.observaciones || undefined,
            compromisos: completionData.compromisos || undefined,
            riesgos: completionData.riesgos || undefined,
            photos: completionData.photos || undefined
        });
    }

    /**
     * Elimina una visita técnica de forma definitiva en Supabase PostgreSQL y sincroniza con Drive
     */
    static async deleteTechnicalVisit(visitId) {
        if (!visitId) return false;
        const vId = String(visitId).trim();

        // 1. Registrar inmediatamente en lista negra de eliminados
        this.addDeletedVisitId(vId);

        // 2. Filtrar caché local y actualizar UI
        let visits = this.getTechnicalVisits();
        visits = visits.filter(v => v.id !== vId);
        this.saveTechnicalVisits(visits);
        window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits } }));

        // 3. Eliminación permanente en Supabase PostgreSQL
        const client = this.getSupabase();
        if (client) {
            try {
                const { error } = await client.from('visitas_tecnicas').delete().eq('id', vId);
                if (!error) {
                    console.log(`[DIAT Supabase] Visita ${vId} eliminada permanentemente de PostgreSQL.`);
                } else {
                    console.error('[DIAT Supabase] Error eliminando en PostgreSQL:', error);
                }
            } catch (supaErr) {
                console.error('[DIAT Supabase] Excepción al eliminar visita:', supaErr);
            }
        }

        // 4. Sincronizar eliminación en Google Drive en la nube
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBFslIOCwVCyAae8-FG0VL5pqotLkjejwJhavm5xoGU4SlyVETwRkGCmDNVkcRPw4/exec";
        const deletePayload = {
            action: "saveVisit",
            folderId: this.DRIVE_VISITAS_FOLDER_ID,
            folderUrl: this.DRIVE_VISITAS_FOLDER_URL,
            file: this.DRIVE_VISITAS_FILENAME,
            visit: {
                id: vId,
                estado: "Eliminada",
                _delete: true,
                delete: true,
                eliminado: true,
                fechaEliminacion: new Date().toISOString()
            }
        };

        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(deletePayload)
            });
            console.log(`[DIAT] Solicitud de eliminación enviada a Google Drive para la visita ${vId}`);
        } catch (err) {
            console.error(`[DIAT] Error enviando eliminación de ${vId} a Google Drive:`, err);
        }

        // 5. Registrar auditoría en Supabase
        this.logActivity('ELIMINACION_VISITA', {
            descripcion: `Eliminación definitiva de visita técnica ${vId}.`,
            detalles: { visitaId: vId }
        });

        return true;
    }

    /**
     * Autentica a un supervisor o administrador ÚNICAMENTE mediante su USUARIO CORTO (ej. JMARINGA, CQUIRAMAH, ADMIN)
     * @param {string} identifier Usuario corto asignado
     * @param {string} password Contraseña
     * @returns {Promise<{success: boolean, user: Object, mustChangePassword: boolean, error?: string}>}
     */
    static async loginUser(identifier, password) {
        let rawInp = String(identifier || '').trim();
        let userKey = '';

        // Si el usuario ingresó por hábito un correo institucional completo, resolver al usuario corto correspondiente
        if (typeof PORTAL_USERS !== 'undefined' && rawInp.includes('@')) {
            const byEmail = Object.entries(PORTAL_USERS).find(([k, u]) => 
                u.email && u.email.toLowerCase() === rawInp.toLowerCase()
            );
            if (byEmail) {
                userKey = byEmail[0];
            }
        }

        if (!userKey) {
            if (rawInp.includes('@')) {
                rawInp = rawInp.split('@')[0];
            }
            userKey = rawInp.toUpperCase().replace(/[^A-Z0-9_]/g, '');
        }

        const passInp = String(password || '').trim();
        const passUpper = passInp.toUpperCase();

        if (!userKey) {
            return {
                success: false,
                error: 'Por favor ingresa tu usuario corto asignado (ej: JMARINGA, ADMIN).'
            };
        }

        // 1. Resolver información institucional mediante USUARIO CORTO
        let displayName = userKey;
        let role = 'Supervisor Técnico DIAT';
        let initials = userKey.slice(0, 2);
        let excelName = userKey;

        let predefined = null;
        if (typeof PORTAL_USERS !== 'undefined') {
            predefined = PORTAL_USERS[userKey] || Object.values(PORTAL_USERS).find(u => 
                (u.name && (typeof normalizeSupervisorName === 'function' ? normalizeSupervisorName(u.name) === normalizeSupervisorName(userKey) : u.name.toUpperCase() === userKey))
            );
            if (predefined) {
                displayName = predefined.name || displayName;
                role = predefined.role || role;
                initials = predefined.initials || initials;
                excelName = predefined.supervisorExcelName || excelName;
            }
        }

        // 2. Manejo de credenciales de usuario corto
        window._pendingChangeUser = userKey;
        try {
            sessionStorage.setItem('diat_last_attempt_user', userKey);
        } catch (e) {}

        const client = this.getSupabase();
        const passHash = await this.hashPassword(passInp);

        // Intento 1: Autenticación centralizada en Supabase PostgreSQL (usuarios_portal)
        if (client) {
            try {
                const { data: supaUser, error: supaErr } = await client
                    .from('usuarios_portal')
                    .select('*')
                    .eq('usuario_corto', userKey)
                    .maybeSingle();

                if (!supaErr && supaUser && supaUser.activo) {
                    const hashMatches = (supaUser.password_hash === passHash);

                    if (hashMatches) {
                        // Actualizar fecha de último acceso en Supabase
                        client.from('usuarios_portal').update({
                            ultimo_ingreso: new Date().toISOString()
                        }).eq('usuario_corto', userKey).then(() => {}).catch(() => {});

                        // Registrar evento de login exitoso en bitácora de auditoría
                        this.logActivity('INICIO_SESION', {
                            usuario: userKey,
                            nombre: supaUser.nombre_completo,
                            descripcion: `Inicio de sesión exitoso de ${supaUser.nombre_completo} (${userKey}).`
                        });

                        // Sincronizar almacenamiento local
                        try {
                            localStorage.setItem(`diat_pw_hash_${userKey}`, passHash);
                            localStorage.setItem(`diat_pw_changed_${userKey}`, supaUser.estado_password === 'personalizada' ? 'true' : 'false');
                        } catch (e) {}

                        const mustChange = (supaUser.estado_password === 'provisional' && userKey !== 'ADMIN');
                        const userObj = {
                            username: supaUser.usuario_corto,
                            name: supaUser.nombre_completo,
                            supervisorExcelName: predefined ? (predefined.supervisorExcelName || supaUser.nombre_completo) : supaUser.nombre_completo,
                            role: supaUser.rol,
                            initials: initials,
                            supabaseAuth: true,
                            passwordCustomized: (supaUser.estado_password === 'personalizada')
                        };

                        return { success: true, user: userObj, mustChangePassword: mustChange };
                    } else {
                        // Intento de contraseña incorrecto registrado en auditoría
                        this.logActivity('LOGIN_FALLIDO', {
                            usuario: userKey,
                            nombre: supaUser.nombre_completo,
                            descripcion: `Intento de acceso fallido para el usuario ${userKey}.`
                        });

                        const isProvBlocked = (passUpper === 'DIAT2026' && supaUser.estado_password === 'personalizada' && userKey !== 'ADMIN');
                        return {
                            success: false,
                            canReset: true,
                            error: isProvBlocked
                                ? 'Ya has personalizado tu contraseña previamente. La clave provisional "DIAT2026" ha quedado inhabilitada por seguridad.'
                                : 'Contraseña incorrecta para el usuario ' + userKey + '. Recuerda que tu contraseña personalizada está activa.'
                        };
                    }
                }
            } catch (err) {
                console.warn('[DIAT Auth] Aviso conectando con usuarios_portal en Supabase, recurriendo a modo híbrido resiliente:', err);
            }
        }

        // Intento 2: Modo híbrido resiliente mediante comprobación de hash SHA-256
        const ADMIN_HASH = '7c1722412f363c4096db8fb20e4b19ce45ac922954dca3f2588d8fdc4edd4958';
        const PROVISIONAL_HASH = '9da5c2920884c11d1406de15761ddabd526df363a0b643b459ffb2d003cc62aa';
        const isOfflineAdmin = (userKey === 'ADMIN' && passHash === ADMIN_HASH);

        const customLocalPw = localStorage.getItem(`diat_pw_${userKey}`);
        const customLocalHash = localStorage.getItem(`diat_pw_hash_${userKey}`);
        const hasChanged = (localStorage.getItem(`diat_pw_changed_${userKey}`) === 'true') || Boolean(customLocalHash) || Boolean(customLocalPw);
        const isCustomLocal = Boolean(
            (customLocalHash && customLocalHash === passHash) ||
            (customLocalPw && customLocalPw === passInp)
        );

        // SEGURIDAD: Si el supervisor ya actualizó su contraseña personal, DIAT2026 queda terminantemente BLOQUEADA
        if (hasChanged && (passHash === PROVISIONAL_HASH || passUpper === 'DIAT2026') && !isOfflineAdmin) {
            return {
                success: false,
                canReset: true,
                error: 'Ya has personalizado tu contraseña previamente. La contraseña inicial provisional ha quedado inhabilitada para tu usuario por seguridad. Por favor ingresa con tu contraseña personalizada.'
            };
        }

        const isDefaultProvisional = (passHash === PROVISIONAL_HASH || passUpper === 'DIAT2026') && !hasChanged;

        if (isOfflineAdmin || isDefaultProvisional || isCustomLocal) {
            // Solo se exige cambio obligatorio si ingresa con la clave provisional inicial por primera vez
            const mustChange = isDefaultProvisional && !hasChanged && !isOfflineAdmin;

            const userObj = {
                username: userKey,
                name: displayName,
                supervisorExcelName: excelName,
                role: role,
                initials: initials,
                supabaseAuth: false,
                passwordCustomized: hasChanged || isCustomLocal
            };

            // Registrar en auditoría
            this.logActivity('INICIO_SESION', {
                usuario: userKey,
                nombre: displayName,
                descripcion: `Inicio de sesión exitoso de ${displayName} (${userKey}) [Modo Resiliente].`
            });

            return { success: true, user: userObj, mustChangePassword: mustChange };
        }

        if (hasChanged) {
            this.logActivity('LOGIN_FALLIDO', {
                usuario: userKey,
                nombre: displayName,
                descripcion: `Intento de acceso fallido para el usuario ${userKey} [Modo Resiliente].`
            });
            return {
                success: false,
                canReset: true,
                error: 'Contraseña incorrecta para el usuario ' + userKey + '. Recuerda que tu contraseña personalizada está activa.'
            };
        }

        return {
            success: false,
            canReset: false,
            error: 'Credenciales inválidas para el usuario ' + userKey + '. Verifica tu usuario corto y contraseña. (Para primer ingreso usa la clave provisional DIAT2026).'
        };
    }

    /**
     * Actualiza la contraseña del usuario en Supabase PostgreSQL (usuarios_portal) y perfil local
     * @param {string} newPassword Nueva contraseña (mínimo 8 caracteres)
     * @param {string} [targetUser] Nombre de usuario opcional (se infiere si no se suministra)
     */
    static async updateUserPassword(newPassword, targetUser) {
        if (!newPassword || newPassword.length < 8) {
            throw new Error('La contraseña debe tener al menos 8 caracteres.');
        }

        // Determinar el usuario de forma ultra-robusta
        let userToUpdate = targetUser;
        if (!userToUpdate && typeof getLoggedUser === 'function') {
            const logged = getLoggedUser();
            if (logged && logged.username) userToUpdate = logged.username;
        }
        if (!userToUpdate && window._pendingChangeUser) {
            userToUpdate = window._pendingChangeUser;
        }
        if (!userToUpdate) {
            try {
                userToUpdate = sessionStorage.getItem('diat_last_attempt_user') || localStorage.getItem('diat_last_attempt_user');
            } catch (e) {}
        }

        const normalizedUser = String(userToUpdate || '').trim().toUpperCase();

        if (normalizedUser) {
            // 1. Guardar en localStorage del navegador como caché offline
            localStorage.setItem(`diat_pw_${normalizedUser}`, newPassword);
            localStorage.setItem(`diat_pw_changed_${normalizedUser}`, 'true');

            // 2. Registro centralizado de credenciales actualizadas
            try {
                const creds = JSON.parse(localStorage.getItem('diat_custom_passwords') || '{}');
                creds[normalizedUser] = {
                    updatedAt: new Date().toISOString(),
                    hasChanged: true
                };
                localStorage.setItem('diat_custom_passwords', JSON.stringify(creds));
            } catch (e) {}

            // 3. Actualizar objeto de usuario en sesión activa si existe
            try {
                ['diat_logged_user'].forEach(key => {
                    const rawSess = sessionStorage.getItem(key) || localStorage.getItem(key);
                    if (rawSess) {
                        const parsed = JSON.parse(rawSess);
                        if (parsed && (parsed.username === normalizedUser || !parsed.username)) {
                            parsed.passwordCustomized = true;
                            if (sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(parsed));
                            if (localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(parsed));
                        }
                    }
                });
            } catch (e) {}

            // 4. Actualizar en Supabase PostgreSQL tabla usuarios_portal
            const client = this.getSupabase();
            if (client) {
                try {
                    const newHash = await this.hashPassword(newPassword);
                    const { error } = await client
                        .from('usuarios_portal')
                        .update({
                            password_hash: newHash,
                            estado_password: 'personalizada',
                            fecha_cambio_password: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('usuario_corto', normalizedUser);

                    if (!error) {
                        console.log(`[DIAT Supabase] Contraseña actualizada en tabla usuarios_portal para ${normalizedUser}`);
                    }
                } catch (err) {
                    console.warn('[DIAT Auth] Aviso actualizando usuarios_portal en Supabase:', err);
                }
            }

            // 5. Registrar evento en bitácora de auditoría
            this.logActivity('CAMBIO_PASSWORD', {
                usuario: normalizedUser,
                descripcion: `El supervisor ${normalizedUser} actualizó exitosamente su contraseña.`
            });
        }

        return true;
    }

    /**
     * Restablece la contraseña de un usuario a la clave provisional DIAT2026
     * @param {string} username 
     */
    static async resetUserPassword(username) {
        const userKey = String(username || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
        if (!userKey) return false;

        // Hash SHA-256 oficial de la clave provisional 'DIAT2026'
        const defaultHash = '9da5c2920884c11d1406de15761ddabd526df363a0b643b459ffb2d003cc62aa';
        const client = this.getSupabase();

        if (client) {
            try {
                await client
                    .from('usuarios_portal')
                    .update({
                        password_hash: defaultHash,
                        estado_password: 'provisional',
                        fecha_cambio_password: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('usuario_corto', userKey);

                this.logActivity('RESTABLECER_PASSWORD', {
                    usuario: userKey,
                    descripcion: `Se restableció la contraseña del usuario ${userKey} a la clave provisional DIAT2026.`
                });
            } catch (e) {
                console.warn('[DIAT Auth] Error restableciendo en Supabase:', e);
            }
        }

        try {
            localStorage.removeItem(`diat_pw_${userKey}`);
            localStorage.removeItem(`diat_pw_changed_${userKey}`);
            const creds = JSON.parse(localStorage.getItem('diat_custom_passwords') || '{}');
            delete creds[userKey];
            localStorage.setItem('diat_custom_passwords', JSON.stringify(creds));
        } catch (e) {}

        return true;
    }

    /**
     * Exporta el historial de auditoría de Supabase a formato CSV compatible con Excel
     */
    static async exportAuditLogsToCSV() {
        try {
            const client = this.getSupabase();
            let logs = [];
            if (client) {
                const { data, error } = await client
                    .from('auditoria_actividad')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(1000);
                if (!error && Array.isArray(data)) {
                    logs = data;
                }
            }
            if (logs.length === 0) {
                logs = this.getAuditLogs();
            }
            if (!logs || logs.length === 0) {
                if (typeof alertToast === 'function') {
                    alertToast('Sin Registros', 'No hay eventos de auditoría disponibles para exportar.', 'info');
                }
                return;
            }

            // Generar archivo CSV con cabeceras y codificación UTF-8 con BOM para Excel
            const headers = ['ID', 'Fecha_Hora_ISO', 'Usuario_Corto', 'Nombre_Supervisor', 'Tipo_Evento', 'Detalle_Operacion'];
            const rows = logs.map(l => {
                const id = `"${(l.id || '').toString().replace(/"/g, '""')}"`;
                const fecha = `"${(l.created_at || l.timestamp || '').toString().replace(/"/g, '""')}"`;
                const user = `"${(l.usuario || '').toString().replace(/"/g, '""')}"`;
                const name = `"${(l.nombre_completo || l.detalles?.nombre || '').toString().replace(/"/g, '""')}"`;
                const evento = `"${(l.tipo_evento || '').toString().replace(/"/g, '""')}"`;
                const desc = `"${(l.descripcion || l.detalles?.descripcion || '').toString().replace(/"/g, '""')}"`;
                return [id, fecha, user, name, evento, desc].join(';');
            });

            const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const dateStr = new Date().toISOString().slice(0, 10);
            a.href = url;
            a.download = `DIAT_Auditoria_Institucional_${dateStr}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            if (typeof alertToast === 'function') {
                alertToast('Exportación Exitosa', `Se descargaron ${logs.length} registros de auditoría en formato CSV para Excel.`);
            }
        } catch (e) {
            console.error('Error exportando auditoría:', e);
            if (typeof alertToast === 'function') {
                alertToast('Error de Exportación', 'No fue posible generar el archivo de auditoría.', 'error');
            }
        }
    }
}

// Función global de exportación de auditoría
window.exportAuditLogsToCSV = function() {
    return DIATDataService.exportAuditLogsToCSV();
};

// Función global de restablecimiento asistido
window.resetUserPassword = async function(userKey) {
    if (!userKey) {
        const inp = document.getElementById('login-username');
        userKey = inp ? inp.value : '';
    }
    userKey = String(userKey || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!userKey) {
        if (typeof alertToast === 'function') {
            alertToast('Usuario requerido', 'Por favor ingresa primero tu usuario corto para restablecer.', 'warning');
        }
        return;
    }
    if (confirm(`¿Deseas restablecer la contraseña del usuario ${userKey} a la clave provisional inicial (DIAT2026)? Al iniciar sesión deberás configurar una nueva contraseña.`)) {
        await DIATDataService.resetUserPassword(userKey);
        const passInp = document.getElementById('login-password');
        if (passInp) {
            passInp.value = 'DIAT2026';
            passInp.focus();
        }
        const errBox = document.getElementById('login-error-alert');
        if (errBox) errBox.classList.add('hidden');
        if (typeof alertToast === 'function') {
            alertToast('Contraseña Restablecida', `Se ha restablecido la clave de ${userKey} a DIAT2026. Haz clic en Iniciar Sesión para acceder y definir una nueva.`, 'info');
        }
    }
};

// Exponer la clase globalmente para su uso en index.html y script.js
window.DIATDataService = DIATDataService;

// Sincronización inicial automática de visitas técnicas desde Supabase Cloud
(function initVisitasData() {
    try {
        const raw = localStorage.getItem('diat_technical_visits');
        if (raw) {
            const parsed = JSON.parse(raw);
            const hasStaleNoPhotos = Array.isArray(parsed) && parsed.some(v => v.id === 'VT-1784224637354' && (!v.photos || v.photos.length === 0));
            if (hasStaleNoPhotos || (Array.isArray(parsed) && parsed.some(v => v.id && (v.id.includes('VT-25AS111B2809-') || v.id.includes('VT-25AS111B2780-') || (v.photos && v.photos.some(p => typeof p === 'string' && p.includes('unsplash'))))))) {
                localStorage.removeItem('diat_technical_visits');
            }
        }

        // Sincronizar en tiempo real desde Supabase PostgreSQL y Storage
        DIATDataService.syncTechnicalVisitsFromServer().then(() => {
            if (typeof renderVisitasTab === 'function') renderVisitasTab();
            if (typeof renderSupervisorPortal === 'function') renderSupervisorPortal();
        }).catch(err => {
            console.warn('[DIAT] Aviso en sincronización en vivo:', err);
        });
    } catch (e) {
        console.error('[DIAT] Error inicializando visitas:', e);
    }
})();
