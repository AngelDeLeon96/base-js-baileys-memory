import { addKeyword } from '@builderbot/bot';
import fs from 'fs';
import mime from 'mime-types';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import logger from './logger.js';
import { isWeekend, getHours, getMinutes } from 'date-fns';
import EnvLoader from './config.ts';
const env = EnvLoader.load();


const ADMIN_NUMBER = env.WB_ADMIN_NUMBER;
const H_INICIO = env.H_INICIO;
const H_SALIDA = env.H_SALIDA;
const ALLOWED_DOCS = env.ALLOWED_DOCS;
const ALLOWED_IMAGES = env.ALLOWED_IMAGES;

const catch_error = (error) => {

    if (error.response) {
        // El servidor respondió con un código de estado fuera del rango 2xx
        if (error.response.status === 404) {
            //console.log('Recurso no encontrado (Error 404).');
            logger.warn('Recurso no encontrado (Error 404).', { 'error': error })

        } else {
            //console.log(`Error en la respuesta del servidor: ${error.response.status}`);
            logger.error(`Error en la respuesta del servidor: `, { 'error': error })
        }
    } else if (error.request) {
        // La solicitud fue hecha pero no se recibió respuesta
        logger.error('No se recibió respuesta del servidor.', { 'error': error })
        //console.log('No se recibió respuesta del servidor.');
    } else {
        // Algo pasó al configurar la solicitud que lanzó un error
        //console.log('Error en la configuración de la solicitud:', error);
        logger.error('Error en la configuración de la solicitud:', { 'error': error });
    }

}

//quita el prefijo de los numero de telefono
const numberClean = (raw) => {
    //Mute +3400000 
    const number = raw.toLowerCase().replace('mute', '').replace(/\s/g, '').replace('+', '')
    // 3400000
    return number
}

const blackListFlow = addKeyword('mute')
    .addAction(async (ctx, { blacklist, flowDynamic }) => {
        if (ctx.from === ADMIN_NUMBER) {
            const toMute = numberClean(ctx.body) //Mute +34000000 message incoming
            const check = blacklist.checkIf(toMute)
            if (!check) {
                blacklist.add(toMute)
                await flowDynamic(`❌ ${toMute} muted`)
                return
            }
            blacklist.remove(toMute)
            await flowDynamic(`🆗 ${toMute} unmuted`)
            return
        }
    })

const verificarOCrearCarpeta = (ruta) => {
    return new Promise((resolve, reject) => {
        fs.access(ruta, fs.constants.F_OK, (err) => {
            if (err) {
                // La carpeta no existe, crearla
                fs.mkdir(ruta, { recursive: true }, (err) => {
                    if (err) {
                        logger.error('Error al crear la carpeta: ', { error: err })
                        reject('Error al crear la carpeta: ' + err);
                    } else {
                        logger.info('Carpeta creada correctamente')
                        resolve('Carpeta creada correctamente.');
                    }
                });
            } else {
                // La carpeta existe
                resolve('La carpeta ya existe.');
            }
        });
    });
}

const esHorarioLaboral = (num) => {
    const fecha = new Date();
    const hora_inicio = Number(H_INICIO ?? 8);
    const hora_salida = Number(H_SALIDA ?? 16);

    const horaActual = getHours(fecha);
    const minutosActual = getMinutes(fecha);
    const tiempoActual = horaActual + minutosActual / 60;
    const esDiaLaboral = !isWeekend(fecha);
    const esHoraLaboral = (
        tiempoActual >= hora_inicio &&
        tiempoActual < hora_salida
    );

    if (!esHoraLaboral || !esDiaLaboral) {
        logger.info('Se intentó acceder fuera de horario laboral', {
            hora: esHoraLaboral,
            dia: esDiaLaboral,
            num: num,
            fechaActual: fecha.toString()
        });
    }

    return esHoraLaboral && esDiaLaboral;
}
const getExtensionFromMime = (mimeType) => {
    const extension = mime.extension(mimeType);
    //console.log(`MIME type: ${mimeType}, Extension: ${extension}`);
    return extension || 'bin';  // 'bin' como fallback si no se encuentra una extensión
}

const getMimeWB = (messages) => {
    for (let key in messages) {
        if (key.endsWith('Message')) {
            //console.log(`El mensaje es de tipo: ${key}`);
            return key;
        }
    }
    //console.log('Tipo de mensaje no reconocido');
    return null;
}

const saveMediaWB = async (payload) => {

    const fecha = new Date();
    //const mime_blocked = ['audio', 'video'];
    let attachment = [];
    let msg = "";
    let status_code = 200;
    const mime = findMyData(payload, "mimetype");
    const ext = getExtensionFromMime(mime);

    //solo texto
    if (payload?.body.includes('_event_') && mime != null) {
        //const mimeType = mime.split("/")[0];
        //console.log('mensaje capturado con el provider: ', mime, "ext: ", ext, ext_blocked.includes(ext));

        if (ALLOWED_IMAGES.includes(ext) || ALLOWED_DOCS.includes(ext)) {
            try {
                msg = findCaption(payload);
                //console.log('caption', caption, msg)
                const nombre = procesarNombreArchivo(msg);
                let filename = nombre.toLocaleLowerCase() || 'file';
                const buffer = await downloadMediaMessage(payload, "buffer");
                const fileName = `${payload.from}_${filename}_${Date.now()}.${ext}`;
                const docsDir = `${process.cwd()}/public/docs/${fecha.getFullYear()}/${fecha.getMonth()}`;
                await verificarOCrearCarpeta(docsDir);
                const pathFile = `${docsDir}/${fileName}`;
                //console.log(pathFile)
                await fs.promises.writeFile(pathFile, buffer);
                //console.log('Archivo guardado correctamente en:', pathFile, saved);
                attachment.push(pathFile);
                status_code = 201;
                logger.info("Procesando archivo docs e images");
            } catch (error) {
                logger.error('Error al procesar el archivo:', { 'error': error })
                //console.error('Error al procesar el archivo:', error);
                msg = "";
                status_code = 404
            }
        } else {
            //console.log('Archivo de audio o video no permitido');
            logger.warn("El usuario intento enviar de audios, notas de voz o videos.")
            msg = "";
            status_code = 401
        }
    } else {
        //console.log('msg without attachments')
        msg = payload?.body;
        status_code = 200
    }

    return [msg, attachment, status_code, ext]
}

const procesarNombreArchivo = (msg) => {
    // Primero, dividimos el nombre y la extensión (si existe)
    const lastDotIndex = msg.lastIndexOf('.');
    let nombre;

    if (lastDotIndex !== -1) {
        nombre = msg.slice(0, lastDotIndex);
        //extension = msg.slice(lastDotIndex + 1);
    } else {
        nombre = msg;
        //extension = null;
    }

    // Reemplazamos espacios por guiones bajos en el nombre
    nombre = nombre.replace(/ /g, '_');

    return nombre;
};

const extractMimeWb = (payload) => {
    const mime = findMyData(payload, "mimetype");
    let ext = mime ? getExtensionFromMime(mime) : null;
    //console.log('mime type: ', mime, extracted_mime);
    return ext;
};


const findMyData = (obj, keyToLook) => {
    // Si obj no es un objeto o es null, retornamos null
    if (typeof obj !== 'object' || obj === null) {
        return null;
    }
    // Si la clave buscada existe directamente en el objeto, retornamos su valor
    if (keyToLook in obj) {
        return obj[keyToLook];
    }

    // Buscamos recursivamente en las propiedades del objeto
    for (let key in obj) {
        const result = findMyData(obj[key], keyToLook);
        if (result !== null) {
            return result;
        }
    }
    //logger.info(`No se encontró la clave ${keyToLook} en el objeto ${Date.now()}`)
    // Si no se encuentra la clave, retornamos null
    return null;
}

const findCaption = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
        return null;
    }

    if (obj.caption) {
        return obj.caption;
    }

    for (let key in obj) {
        const result = findCaption(obj[key]);
        if (result) {
            return result;
        }
    }

    return "Archivo adjunto sin mensaje";
}

const verifyMSG = (texto) => {
    //verifica si es un texto cualquiera
    const regex = /_event_\w+__[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;
    return !regex.test(texto);
}
//verifica que el texto sea un numero para el input de los switches
const verifyInput = (input) => {
    const regex = /^\d$/
    return regex.test(input)
}

const checkInputMenu = (text) => {
    //debe ser "false", si es "true" significa que el usuario envio una imagen, doc, video, etc. No queremos eso...
    const msg = verifyMSG(text)

    //debe ser un valor numerico es decir "true"
    const input = verifyInput(text)

    if (msg && input)
        return true
    console.log(`msg: ${msg}, input digit: ${input}`)

    return false
}

const formatName = (text) => {
    return text.split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

const break_flow = (content) => {
    const keywords = ['hasta luego', 'adios', 'resuelto'];

    let partial = content ? keywords.includes(content.normalize('NFD').toLowerCase().replace(/[\u0300-\u036f]/g, "")) : false
    return partial;
}

export { catch_error, numberClean, blackListFlow, verificarOCrearCarpeta, esHorarioLaboral, getExtensionFromMime, getMimeWB, saveMediaWB, extractMimeWb, findMyData, break_flow, verifyMSG, formatName, verifyInput, checkInputMenu };