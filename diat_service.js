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
    return {
        ...v,
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
     * Sincroniza las visitas técnicas registradas desde el archivo visitas.json de Google Drive
     */
    static async syncTechnicalVisitsFromServer() {
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBFslIOCwVCyAae8-FG0VL5pqotLkjejwJhavm5xoGU4SlyVETwRkGCmDNVkcRPw4/exec";
        try {
            const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getVisits&folderId=${this.DRIVE_VISITAS_FOLDER_ID}&folderUrl=${encodeURIComponent(this.DRIVE_VISITAS_FOLDER_URL)}&file=${encodeURIComponent(this.DRIVE_VISITAS_FILENAME)}`);
            if (response.ok) {
                const visits = await response.json();
                if (Array.isArray(visits) && visits.length > 0) {
                    // Detectar y registrar visitas marcadas como eliminadas en el servidor para que se replique en todas las IPs
                    visits.forEach(v => {
                        if (v && v.id && (v._delete === true || v.delete === true || v.estado === 'Eliminada' || v.estado === 'Eliminado' || v.eliminado === true)) {
                            this.addDeletedVisitId(v.id);
                        }
                    });

                    const deletedIds = this.getDeletedVisitIds();

                    const validServerVisits = visits.filter(v => {
                        if (!v || !v.id || !v.id.startsWith('VT-') || v.id.startsWith('TEST-')) return false;
                        if (v._delete === true || v.delete === true || v.estado === 'Eliminada' || v.estado === 'Eliminado' || v.eliminado === true) return false;
                        if (deletedIds.has(v.id)) return false;
                        return true;
                    }).map(v => sanitizeVisit({
                        ...v,
                        estado: v.estado || 'Realizada',
                        prioridad: v.prioridad || 'Media'
                    }));

                    const localVisits = this.getTechnicalVisits().filter(v => !deletedIds.has(v.id));
                    const visitMap = new Map();
                    validServerVisits.forEach(v => visitMap.set(v.id, v));
                    localVisits.forEach(v => {
                        if (!visitMap.has(v.id)) {
                            visitMap.set(v.id, sanitizeVisit(v));
                        }
                    });

                    const merged = Array.from(visitMap.values()).filter(v => !deletedIds.has(v.id));
                    this.saveTechnicalVisits(merged);

                    window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits: merged } }));
                    return true;
                }
            }
        } catch (e) {
            console.error("Error sincronizando visitas desde Google Drive (visitas.json):", e);
        }

        // Fallback: cargar archivo local visitas.json
        try {
            const localResp = await fetch('./visitas.json');
            if (localResp.ok) {
                const localVisits = await localResp.json();
                if (Array.isArray(localVisits) && localVisits.length > 0) {
                    const deletedIds = this.getDeletedVisitIds();
                    const current = this.getTechnicalVisits().filter(v => !deletedIds.has(v.id));
                    const visitMap = new Map();
                    current.forEach(v => visitMap.set(v.id, sanitizeVisit(v)));
                    localVisits.filter(v => v && v.id && v.id.startsWith('VT-') && !v.id.startsWith('TEST-') && !deletedIds.has(v.id) && !v._delete && !v.delete && v.estado !== 'Eliminada' && v.estado !== 'Eliminado').forEach(v => {
                        if (!visitMap.has(v.id)) {
                            visitMap.set(v.id, sanitizeVisit({
                                ...v,
                                estado: v.estado || 'Realizada',
                                prioridad: v.prioridad || 'Media'
                            }));
                        }
                    });
                    const mergedLocal = Array.from(visitMap.values()).filter(v => !deletedIds.has(v.id));
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
     * Registra una visita técnica localmente y la sincroniza con Google Drive
     */
    static async addTechnicalVisit(username, convenioId, visitData) {
        const newVisit = sanitizeVisit({
            id: 'VT-' + Date.now(),
            convenioId: String(convenioId).trim(),
            usuario: username || 'Jonathan Marín Gallego',
            estado: visitData.estado || 'Realizada', // 'Realizada' | 'Programada'
            prioridad: visitData.prioridad || 'Media',
            fecha: visitData.fecha || new Date().toLocaleDateString('es-CO'),
            tipo: visitData.tipo || 'Avance de obra',
            municipio: visitData.municipio || '',
            subregion: visitData.subregion || '',
            observaciones: visitData.observaciones || '',
            compromisos: visitData.compromisos || '',
            riesgos: visitData.riesgos || '',
            lat: parseFloat(visitData.lat) || 0,
            lng: parseFloat(visitData.lng) || 0,
            photoCount: Array.isArray(visitData.photos) ? visitData.photos.length : (parseInt(visitData.photoCount) || 0),
            photos: Array.isArray(visitData.photos) ? visitData.photos : []
        });

        // Guardar en caché local
        const visits = this.getTechnicalVisits();
        visits.unshift(newVisit);
        this.saveTechnicalVisits(visits);

        // Notificar cambio inmediato en la UI
        window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits } }));

        // Sincronizar con Google Drive en segundo plano (POST sin bloquear UI)
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBFslIOCwVCyAae8-FG0VL5pqotLkjejwJhavm5xoGU4SlyVETwRkGCmDNVkcRPw4/exec";
        try {
            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
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

        return newVisit;
    }

    /**
     * Actualiza una visita técnica localmente y la sincroniza con Google Drive
     */
    static async updateTechnicalVisit(visitId, visitData) {
        const visits = this.getTechnicalVisits();
        const idx = visits.findIndex(v => v.id === visitId);
        if (idx === -1) return null;

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
            photoCount: visitData.photos !== undefined ? visitData.photos.length : visits[idx].photoCount,
            photos: visitData.photos !== undefined ? visitData.photos : visits[idx].photos
        });

        // Guardar en caché local
        visits[idx] = updatedVisit;
        this.saveTechnicalVisits(visits);

        // Notificar cambio inmediato en la UI
        window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits } }));

        // Sincronizar con Google Drive en segundo plano (POST sin bloquear UI)
        const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwXBFslIOCwVCyAae8-FG0VL5pqotLkjejwJhavm5xoGU4SlyVETwRkGCmDNVkcRPw4/exec";
        try {
            fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: {
                    "Content-Type": "text/plain"
                },
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
     * Elimina una visita técnica localmente y en Google Drive en tiempo real
     */
    static async deleteTechnicalVisit(visitId) {
        if (!visitId) return false;
        const vId = String(visitId).trim();

        // 1. Registrar inmediatamente en lista negra de eliminados
        this.addDeletedVisitId(vId);

        // 2. Filtrar caché local y actualizar
        let visits = this.getTechnicalVisits();
        visits = visits.filter(v => v.id !== vId);
        this.saveTechnicalVisits(visits);

        // 3. Notificar cambio inmediato en la UI
        window.dispatchEvent(new CustomEvent('diat:visitasUpdated', { detail: { visits } }));

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
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify(deletePayload)
            });
            console.log(`[DIAT] Solicitud de eliminación enviada a Google Drive para la visita ${vId}`);
        } catch (err) {
            console.error(`[DIAT] Error enviando eliminación de ${vId} a Google Drive:`, err);
        }

        return true;
    }
}

// Exponer la clase globalmente para su uso en index.html y script.js
window.DIATDataService = DIATDataService;

// Purga de visitas simuladas y carga inicial automatica de visitas.json autentico
(function initVisitasData() {
    try {
        const raw = localStorage.getItem('diat_technical_visits');
        const deletedIds = DIATDataService.getDeletedVisitIds ? DIATDataService.getDeletedVisitIds() : new Set();
        let needsReload = false;
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.some(v => v.id && (v.id.includes('VT-25AS111B2809-') || v.id.includes('VT-25AS111B2780-') || (v.photos && v.photos.some(p => typeof p === 'string' && p.includes('unsplash')))))) {
                console.log('[DIAT] Purgando visitas simuladas no autenticas de localStorage...');
                localStorage.removeItem('diat_technical_visits');
                needsReload = true;
            } else if (!Array.isArray(parsed)) {
                needsReload = true;
            }
        } else {
            needsReload = true;
        }

        // Cargar fallback local enriqueciendo lo que falte
        if (needsReload) {
            fetch('./visitas.json')
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    if (Array.isArray(data) && data.length > 0) {
                        const current = DIATDataService.getTechnicalVisits().filter(v => !deletedIds.has(v.id));
                        const visitMap = new Map();
                        data.filter(v => v && v.id && v.id.startsWith('VT-') && !v.id.startsWith('TEST-') && !deletedIds.has(v.id) && !v._delete && !v.delete && v.estado !== 'Eliminada' && v.estado !== 'Eliminado').forEach(v => {
                            visitMap.set(v.id, {
                                ...v,
                                estado: v.estado || 'Realizada',
                                prioridad: v.prioridad || 'Media'
                            });
                        });
                        current.forEach(v => visitMap.set(v.id, v));
                        const unified = Array.from(visitMap.values()).filter(v => !deletedIds.has(v.id));
                        DIATDataService.saveTechnicalVisits(unified);
                        console.log('[DIAT] Archivo visitas.json cargado exitosamente (' + unified.length + ' visitas organizadas).');
                        if (typeof renderVisitasTab === 'function') renderVisitasTab();
                        if (typeof renderSupervisorPortal === 'function') renderSupervisorPortal();
                    }
                })
                .catch(e => console.warn('[DIAT] Error precargando visitas.json:', e))
                .finally(() => {
                    // Sincronizar en línea con Google Drive en tiempo real
                    DIATDataService.syncTechnicalVisitsFromServer().then(() => {
                        if (typeof renderVisitasTab === 'function') renderVisitasTab();
                        if (typeof renderSupervisorPortal === 'function') renderSupervisorPortal();
                    });
                });
        } else {
            // Sincronizar en línea con Google Drive en tiempo real
            DIATDataService.syncTechnicalVisitsFromServer().then(() => {
                if (typeof renderVisitasTab === 'function') renderVisitasTab();
                if (typeof renderSupervisorPortal === 'function') renderSupervisorPortal();
            });
        }
    } catch (e) {
        console.error('[DIAT] Error inicializando visitas:', e);
    }
})();
